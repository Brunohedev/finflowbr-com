import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Transcribes a short voice note and extracts expense fields. Audio is never stored.
const GATEWAY = 'https://ai.gateway.lovable.dev/v1';
const MAX_BYTES = 10 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['description', 'amount', 'merchant', 'date'],
  properties: {
    description: { type: ['string', 'null'] },
    amount: { type: ['number', 'null'] },
    merchant: { type: ['string', 'null'] },
    date: { type: ['string', 'null'], description: 'YYYY-MM-DD, only if the user stated or clearly implied it' },
  },
};

async function extract(apiKey: string, transcript: string, today: string) {
  const res = await fetch(`${GATEWAY}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' },
    body: JSON.stringify({
      model: 'openai/gpt-6-astra',
      stream: true,
      store: false,
      reasoning: { effort: 'low' },
      instructions:
        `Extract one expense from the user's spoken sentence. Today is ${today}. ` +
        'Never invent values: use null for anything not said. Amount is a positive number. ' +
        'Description is a short noun phrase (e.g. "Groceries"). Resolve relative dates like "yesterday" against today; if no date is mentioned, return null.',
      input: [{ role: 'user', content: transcript }],
      text: { format: { type: 'json_schema', name: 'expense', strict: true, schema } },
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text();
    throw Object.assign(new Error(t || `extract ${res.status}`), { status: res.status });
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === 'response.output_text.delta') out += ev.delta ?? '';
      } catch { /* ignore partial */ }
    }
  }
  return JSON.parse(out);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: cErr } = await sb.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (cErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ error: 'Voice service is not configured' }, 500);

    const form = await req.formData();
    const file = form.get('file');
    const today = String(form.get('today') || new Date().toISOString().slice(0, 10)).slice(0, 10);
    if (!(file instanceof File) || !file.size) return json({ error: 'No audio received' }, 400);
    if (file.size > MAX_BYTES) return json({ error: 'Recording is too long' }, 400);

    const tf = new FormData();
    tf.append('model', 'openai/gpt-transcribe');
    tf.append('file', new File([file], file.name || 'audio.webm', { type: file.type.replace('video/', 'audio/') || 'audio/webm' }));
    tf.append('response_format', 'json');
    const tRes = await fetch(`${GATEWAY}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: tf,
    });
    const tBody = await tRes.json().catch(() => ({}));
    if (!tRes.ok) {
      console.error('[voice-expense] transcribe failed', tRes.status, tBody);
      return json({ error: tBody?.error?.message || tBody?.message || 'Could not transcribe audio' }, tRes.status);
    }
    const transcript = String(tBody?.text ?? '').trim();
    if (!transcript) return json({ error: "We couldn't hear anything. Please try again." }, 422);

    const fields = await extract(apiKey, transcript, today);
    const amount = typeof fields.amount === 'number' && fields.amount > 0 ? Math.round(fields.amount * 100) / 100 : null;
    const date = typeof fields.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fields.date) ? fields.date : null;
    return json({
      transcript,
      description: fields.description || null,
      merchant: fields.merchant || null,
      amount,
      date,
    });
  } catch (e) {
    const status = (e as any)?.status;
    console.error('[voice-expense] error', String(e));
    return json({ error: 'Could not process the audio. Please try again.' }, status === 402 || status === 429 ? status : 500);
  }
});
