CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  name text CHECK (name IS NULL OR char_length(name) <= 100),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 1000),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.account_deletion_requests TO anon, authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit a deletion request" ON public.account_deletion_requests
FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');