import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DeleteAccount from "@/pages/DeleteAccount";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), logout: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "owner", email: "test@example.invalid" }, logout: mocks.logout }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ t: (s: string) => s }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
const show = () => render(<MemoryRouter initialEntries={["/excluir-conta"]}><Routes>
  <Route path="/excluir-conta" element={<DeleteAccount />} />
  <Route path="/login" element={<input aria-label="signed-out" />} />
</Routes></MemoryRouter>);

describe("deletion confirmation and results", () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); mocks.logout.mockResolvedValue(undefined); });
  it("requires DELETE and does not submit an invalid confirmation", () => {
    show();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "delete-me" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("does not claim success or sign out on partial failure", async () => {
    mocks.invoke.mockResolvedValue({ data: { error: "incomplete" }, error: null });
    localStorage.setItem("retained", "data");
    show();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(localStorage.getItem("retained")).toBe("data");
  });
  it("rejects a response without explicit success", async () => {
    mocks.invoke.mockResolvedValue({ data: {}, error: null });
    show();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("clears device cache and signs out only after server-confirmed deletion", async () => {
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
    localStorage.setItem("retained", "data");
    show();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "signed-out" })).toBeInTheDocument());
    expect(mocks.invoke).toHaveBeenCalledWith("delete-account");
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("retained")).toBeNull();
  });
});