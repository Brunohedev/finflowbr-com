import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Pricing from "@/pages/Pricing";
import Sucesso from "@/pages/Sucesso";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  checkSubscription: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: false,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: mocks.isAuthenticated,
    isLoading: false,
    subscription: null,
    checkSubscription: mocks.checkSubscription,
    logout: mocks.logout,
  }),
}));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ t: (s: string) => s }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const LocationEcho = () => {
  const loc = useLocation();
  return <output aria-label="route">{`${loc.pathname}${loc.search}`}</output>;
};

describe("gated billing frontend flows", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.isAuthenticated = false;
    mocks.checkSubscription.mockResolvedValue(undefined);
  });

  it("routes unauthenticated visitors to sign up with return to /planos when checkout_v2 is active", async () => {
    mocks.invoke.mockResolvedValue({
      data: { checkout_v2: true, checkout_confirmation: true, account_deletion_with_cancellation: true, trial_seconds: 259200 },
      error: null,
    });
    render(
      <MemoryRouter initialEntries={["/planos"]}>
        <Routes>
          <Route path="/planos" element={<Pricing />} />
          <Route path="/login" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>,
    );
    const buttons = await screen.findAllByRole("button", { name: "Criar conta e testar grátis" });
    fireEvent.click(buttons[0]);
    const route = await screen.findByLabelText("route");
    expect(route.textContent).toBe("/login?mode=register&next=/planos");
  });

  it("calls create-checkout-v2 when authenticated and checkout_v2 is active", async () => {
    mocks.isAuthenticated = true;
    mocks.invoke.mockImplementation(async (name: string) => {
      if (name === "billing-capabilities") {
        return { data: { checkout_v2: true, checkout_confirmation: true, account_deletion_with_cancellation: true, trial_seconds: 259200 }, error: null };
      }
      return { data: { url: null, code: "already_subscribed", trial: false }, error: null };
    });
    render(
      <MemoryRouter initialEntries={["/planos"]}>
        <Routes>
          <Route path="/planos" element={<Pricing />} />
          <Route path="/app" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>,
    );
    const buttons = await screen.findAllByRole("button", { name: "Começar 3 dias grátis" });
    fireEvent.click(buttons[0]);
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("create-checkout-v2", {
        body: expect.objectContaining({ plan: "mensal", request_id: expect.any(String) }),
      })
    );
    expect((await screen.findByLabelText("route")).textContent).toBe("/app");
  });

  it("allows direct subscription without trial via skip_trial when authenticated", async () => {
    mocks.isAuthenticated = true;
    mocks.invoke.mockImplementation(async (name: string) => {
      if (name === "billing-capabilities") {
        return { data: { checkout_v2: true, checkout_confirmation: true, account_deletion_with_cancellation: true, trial_seconds: 259200 }, error: null };
      }
      return { data: { url: null, code: "already_subscribed", trial: false }, error: null };
    });
    render(
      <MemoryRouter initialEntries={["/planos"]}>
        <Routes>
          <Route path="/planos" element={<Pricing />} />
          <Route path="/app" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>,
    );
    const directButtons = await screen.findAllByRole("button", { name: "Assinar agora" });
    fireEvent.click(directButtons[0]);
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("create-checkout-v2", {
        body: expect.objectContaining({ plan: "mensal", skip_trial: true, request_id: expect.any(String) }),
      })
    );
  });

  it("confirms 72h trial start on /sucesso via checkout-confirmation", async () => {
    mocks.isAuthenticated = true;
    mocks.invoke.mockImplementation(async (name: string) => {
      if (name === "billing-capabilities") {
        return { data: { checkout_v2: true, checkout_confirmation: true, account_deletion_with_cancellation: true, trial_seconds: 259200 }, error: null };
      }
      return { data: { subscribed: true, trial_started: true, payment_received: false }, error: null };
    });
    render(
      <MemoryRouter initialEntries={["/sucesso?session_id=cs_live_abc123"]}>
        <Routes>
          <Route path="/sucesso" element={<Sucesso />} />
          <Route path="/app" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: /Teste grátis ativado/i })).toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledWith("checkout-confirmation", {
      body: { session_id: "cs_live_abc123" },
    });
  });

  it("shows expired state on /sucesso when checkout-confirmation reports CHECKOUT_EXPIRED", async () => {
    mocks.isAuthenticated = true;
    mocks.invoke.mockImplementation(async (name: string) => {
      if (name === "billing-capabilities") {
        return { data: { checkout_v2: true, checkout_confirmation: true, account_deletion_with_cancellation: true, trial_seconds: 259200 }, error: null };
      }
      return { data: { code: "CHECKOUT_EXPIRED" }, error: null };
    });
    render(
      <MemoryRouter initialEntries={["/sucesso?session_id=cs_live_expired1"]}>
        <Routes>
          <Route path="/sucesso" element={<Sucesso />} />
          <Route path="/planos" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Checkout expirado" })).toBeInTheDocument();
  });

  it("keeps plan buttons disabled while billing-capabilities is loading so legacy checkout cannot fire", async () => {
    mocks.isAuthenticated = true;
    let resolveCapabilities!: (value: { data: Record<string, unknown>; error: null }) => void;
    mocks.invoke.mockImplementation((name: string) => {
      if (name === "billing-capabilities") {
        return new Promise((resolve) => { resolveCapabilities = resolve; });
      }
      return Promise.resolve({ data: null, error: null });
    });
    render(
      <MemoryRouter initialEntries={["/planos"]}>
        <Routes>
          <Route path="/planos" element={<Pricing />} />
        </Routes>
      </MemoryRouter>,
    );
    const loadingButtons = screen.getAllByRole("button", { name: "Carregando..." });
    expect(loadingButtons[0]).toBeDisabled();
    fireEvent.click(loadingButtons[0]);
    expect(mocks.invoke).not.toHaveBeenCalledWith("create-checkout", expect.anything());
    resolveCapabilities({
      data: { checkout_v2: true, checkout_confirmation: true, account_deletion_with_cancellation: true, trial_seconds: 259200 },
      error: null,
    });
    const readyButtons = await screen.findAllByRole("button", { name: "Começar 3 dias grátis" });
    expect(readyButtons[0]).not.toBeDisabled();
  });
});