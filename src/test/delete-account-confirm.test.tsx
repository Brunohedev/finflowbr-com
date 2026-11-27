import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DeleteAccount from "@/pages/DeleteAccount";
import { DELETION_CONSENT_VERSION } from "@/lib/billingCapabilities";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), logout: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "owner", email: "test@example.invalid" }, logout: mocks.logout }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ t: (s: string) => s }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
const show = () => render(<MemoryRouter initialEntries={["/excluir-conta"]}><Routes>
  <Route path="/excluir-conta" element={<DeleteAccount />} />
  <Route path="/login" element={<input aria-label="signed-out" />} />
</Routes></MemoryRouter>);

const mockCapabilities = (accountDeletionWithCancellation: boolean, deleteResult = { data: { success: true }, error: null }) => {
  mocks.invoke.mockImplementation(async (name: string) => {
    if (name === "billing-capabilities") {
      return {
        data: {
          checkout_v2: accountDeletionWithCancellation,
          checkout_confirmation: accountDeletionWithCancellation,
          account_deletion_with_cancellation: accountDeletionWithCancellation,
          trial_seconds: 259200,
        },
        error: null,
      };
    }
    return deleteResult;
  });
};

describe("deletion confirmation and results", () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); mocks.logout.mockResolvedValue(undefined); });

  it("requires DELETE and does not submit an invalid confirmation", async () => {
    mockCapabilities(false);
    show();
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("billing-capabilities", { body: null }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "delete-me" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    expect(mocks.invoke).not.toHaveBeenCalledWith("delete-account");
    expect(mocks.invoke).not.toHaveBeenCalledWith("delete-account-v2", expect.anything());
  });

  it("does not claim success or sign out on partial failure", async () => {
    mockCapabilities(false, { data: { error: "incomplete" } as unknown as { success: boolean }, error: null });
    localStorage.setItem("retained", "data");
    show();
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("billing-capabilities", { body: null }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(localStorage.getItem("retained")).toBe("data");
  });

  it("rejects a response without explicit success", async () => {
    mockCapabilities(false, { data: {} as unknown as { success: boolean }, error: null });
    show();
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("billing-capabilities", { body: null }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("clears device cache and signs out only after server-confirmed deletion", async () => {
    mockCapabilities(false);
    localStorage.setItem("retained", "data");
    show();
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("billing-capabilities", { body: null }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "signed-out" })).toBeInTheDocument());
    expect(mocks.invoke).toHaveBeenCalledWith("delete-account");
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("retained")).toBeNull();
  });

  it("requires explicit unchecked cancellation checkbox before invoking delete-account-v2", async () => {
    mockCapabilities(true);
    show();
    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
    const button = screen.getByRole("button", { name: "Excluir minha conta" });
    expect(button).toBeDisabled();

    fireEvent.click(checkbox);
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByRole("textbox", { name: "signed-out" })).toBeInTheDocument());
    expect(mocks.invoke).toHaveBeenCalledWith("delete-account-v2", {
      body: {
        confirmation: "DELETE",
        consent_version: DELETION_CONSENT_VERSION,
        cancel_subscriptions: true,
      },
    });
  });

  it("keeps account untouched and shows clear alert when Stripe cancellation fails", async () => {
    mockCapabilities(true, { data: { code: "SUBSCRIPTION_CANCEL_FAILED" } as unknown as { success: boolean }, error: null });
    localStorage.setItem("retained", "data");
    show();
    const checkbox = await screen.findByRole("checkbox");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("exclusão da conta não foi iniciada");
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(localStorage.getItem("retained")).toBe("data");
  });
});