import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthenticatedRoute from "@/components/AuthenticatedRoute";
import ProtectedRoute from "@/components/ProtectedRoute";

const mocks = vi.hoisted(() => ({ auth: { isAuthenticated: true, isLoading: false, user: { id: "owner" }, subscription: { status: "expired" } }, access: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/getAccess", () => ({ getAccess: mocks.access }));
vi.mock("@/hooks/useBankForegroundRefresh", () => ({ useBankForegroundRefresh: vi.fn() }));

const show = (path = "/excluir-conta") => render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/excluir-conta" element={<AuthenticatedRoute><input aria-label="deletion-confirmation" /></AuthenticatedRoute>} />
  <Route path="/app" element={<ProtectedRoute><input aria-label="paid-feature" /></ProtectedRoute>} />
  <Route path="/login" element={<input aria-label="login" />} />
  <Route path="/planos" element={<input aria-label="plans" />} />
</Routes></MemoryRouter>);

describe("deletion is independent of paid access", () => {
  beforeEach(() => { cleanup(); mocks.auth.isAuthenticated = true; mocks.auth.isLoading = false; mocks.access.mockReset().mockResolvedValue("none"); });
  it.each(["expired", "canceled", "inactive"])("allows authenticated %s subscribers to delete", status => {
    mocks.auth.subscription.status = status;
    show();
    expect(screen.getByRole("textbox", { name: "deletion-confirmation" })).toBeInTheDocument();
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("still requires authentication", () => {
    mocks.auth.isAuthenticated = false;
    show();
    expect(screen.getByRole("textbox", { name: "login" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "deletion-confirmation" })).not.toBeInTheDocument();
  });
  it("waits for session restoration", () => {
    mocks.auth.isLoading = true;
    show();
    expect(screen.queryByRole("textbox", { name: "deletion-confirmation" })).not.toBeInTheDocument();
  });
  it("does not unlock the paid dashboard", async () => {
    show("/app");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "plans" })).toBeInTheDocument());
    expect(screen.queryByRole("textbox", { name: "paid-feature" })).not.toBeInTheDocument();
  });
});