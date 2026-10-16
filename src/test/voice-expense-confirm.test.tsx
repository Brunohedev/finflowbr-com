import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VoiceExpenseBar from "@/components/VoiceExpenseBar";
import { DEFAULT_CATEGORIES } from "@/types/finance";

// Mock supabase session
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ t: (k: string) => k }) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok" } } }),
    },
  },
}));

// Mock MediaRecorder
class MockMediaRecorder {
  ondataavailable: ((e: any) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType = "audio/webm";
  start() {}
  stop() { this.onstop?.(); }
}
(globalThis as any).MediaRecorder = MockMediaRecorder;
Object.defineProperty(globalThis.navigator, "mediaDevices", {
  value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: () => {} }] }) },
  configurable: true,
});

const mockFetch = (body: any, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });

describe("VoiceExpenseBar confirm flow", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, "mediaDevices", { value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: () => {} }] }) }, configurable: true });
  });

  const recordAndConfirm = async (onAddExpense: any, backendBody: any) => {
    (globalThis as any).fetch = mockFetch(backendBody);
    render(<VoiceExpenseBar categories={DEFAULT_CATEGORIES} onAddExpense={onAddExpense} />);

    fireEvent.click(screen.getByLabelText("Start recording"));
    fireEvent.click(await screen.findByLabelText("Stop recording"));

    await screen.findByText("We Identified Your Expense");
    fireEvent.click(screen.getByRole("button", { name: "Mercado" }));
    const confirmBtn = screen.getByRole("button", { name: "Confirm Expense" });
    return confirmBtn;
  };

  it("confirms a fully detected expense", async () => {
    const onAddExpense = vi.fn();
    const btn = await recordAndConfirm(onAddExpense, {
      description: "Groceries", merchant: "Walmart", amount: 35, date: "2026-10-16",
    });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    await waitFor(() => expect(onAddExpense).toHaveBeenCalledTimes(1));
    expect(onAddExpense.mock.calls[0][0]).toMatchObject({
      name: "Groceries · Walmart", amount: 35, categoryId: "essenciais", subcategoryId: "mercado",
    });
  });

  it("keeps confirm disabled silently when description is missing", async () => {
    const onAddExpense = vi.fn();
    const btn = await recordAndConfirm(onAddExpense, {
      description: null, merchant: null, amount: 12, date: null,
    });
    await waitFor(() => expect(btn).toBeDisabled());
    fireEvent.click(btn);
    expect(onAddExpense).not.toHaveBeenCalled();
  });

  it("does not double-save on repeated clicks", async () => {
    const onAddExpense = vi.fn();
    const btn = await recordAndConfirm(onAddExpense, {
      description: "Gas", merchant: null, amount: 12, date: "2026-10-16",
    });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(onAddExpense).toHaveBeenCalledTimes(1));
  });

  it("passes installments when split by month is on", async () => {
    const onAddExpense = vi.fn();
    const btn = await recordAndConfirm(onAddExpense, { description: "TV", merchant: null, amount: 300, date: "2026-10-16" });
    fireEvent.click(screen.getByLabelText("Installments"));
    fireEvent.change(screen.getByLabelText("Number of installments"), { target: { value: "3" } });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    expect(onAddExpense.mock.calls[0][0]).toMatchObject({ amount: 300, installments: 3 });
  });

  it("omits installments for ordinary voice expenses", async () => {
    const onAddExpense = vi.fn();
    const btn = await recordAndConfirm(onAddExpense, { description: "Gas", merchant: null, amount: 12, date: "2026-10-16" });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    expect(onAddExpense.mock.calls[0][0].installments).toBeUndefined();
  });
});
