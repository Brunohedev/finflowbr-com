import { it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VoiceExpenseBar from "@/components/VoiceExpenseBar";
import { DEFAULT_CATEGORIES } from "@/types/finance";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "t" } } }) } } }));
class MR { ondataavailable:any=null; onstop:any=null; mimeType="audio/webm"; start(){} stop(){ this.onstop?.(); } }
(globalThis as any).MediaRecorder = MR;
it("dbg", async () => {
  console.log("mediaDevices before:", (globalThis.navigator as any).mediaDevices);
  Object.defineProperty(globalThis.navigator, "mediaDevices", { value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: () => {} }] }) }, configurable: true });
  console.log("mediaDevices after:", (globalThis.navigator as any).mediaDevices);
  render(<VoiceExpenseBar categories={DEFAULT_CATEGORIES} onAddExpense={vi.fn()} />);
  fireEvent.click(screen.getByLabelText("Start recording"));
  await new Promise(r => setTimeout(r, 100));
  console.log("html:", document.body.innerHTML.slice(0, 600));
});
