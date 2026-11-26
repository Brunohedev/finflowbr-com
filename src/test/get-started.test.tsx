import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VSL from "@/pages/VSL";
import DemoSimulation from "@/components/DemoSimulation";
import { GET_STARTED_PATH } from "@/lib/getStarted";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ t: (s: string) => s }) }));
vi.mock("@/components/VSLVideoPlayer", () => ({
  default: ({ onUnlock }: { onUnlock?: () => void }) => (
    <button onClick={onUnlock}>unblock-cta</button>
  ),
}));

const showVsl = () =>
  render(
    <MemoryRouter initialEntries={["/vsl"]}>
      <Routes>
        <Route path="/vsl" element={<VSL />} />
        <Route path="/login" element={<div>login-screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("the 'Começar agora' call to action", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("points at the login screen opened on the account-creation tab", () => {
    expect(GET_STARTED_PATH).toBe("/login?mode=register");
  });

  it("sends a visitor who finished the video to the account-creation tab", () => {
    showVsl();
    expect(screen.queryByText("Começar agora")).toBeNull();

    fireEvent.click(screen.getByText("unblock-cta"));
    const ctas = screen.getAllByRole("button", { name: /Começar agora/ });
    expect(ctas.length).toBeGreaterThan(0);

    fireEvent.click(ctas[0]);
    expect(screen.getByText("login-screen")).toBeTruthy();
  });

  it("runs the demo's own 'Começar agora' through the same hand-off", async () => {
    const onGetStarted = vi.fn();
    const onOpenChange = vi.fn();
    render(<DemoSimulation open onOpenChange={onOpenChange} onGetStarted={onGetStarted} />);

    fireEvent.click(screen.getByRole("button", { name: /Rodar simulação/ }));
    const cta = await screen.findByRole("button", { name: /Começar agora/ }, { timeout: 15000 });
    fireEvent.click(cta);

    expect(onGetStarted).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  }, 20000);
});
