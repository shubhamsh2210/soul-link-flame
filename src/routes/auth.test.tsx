import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery, routerMock } from "@/test/helpers";

const h = vi.hoisted(() => ({
  signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@tanstack/react-router", async () => (await import("@/test/helpers")).routerMock());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: h.signInWithPassword,
      signUp: vi.fn(),
    },
  },
}));

vi.mock("@/integrations/lovable/index", () => ({
  lovable: { auth: { signInWithOAuth: h.signInWithOAuth } },
}));

const { Route } = await import("@/routes/auth");
const Page = (Route as unknown as { component: React.ComponentType }).component;

describe("auth screen smoke", () => {
  it("renders the sign-in form", async () => {
    renderWithQuery(<Page />);
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("signs in with email and password", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Page />);
    await user.type(screen.getByLabelText(/email/i), "peer@example.com");
    await user.type(screen.getByLabelText(/password/i), "hunter2!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(h.signInWithPassword).toHaveBeenCalledWith({
        email: "peer@example.com",
        password: "hunter2!",
      }),
    );
  });

  it("starts Google OAuth through the Lovable broker", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Page />);
    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => expect(h.signInWithOAuth).toHaveBeenCalledWith("google", expect.anything()));
  });
});

// keep the helper import referenced for type-checkers
void routerMock;
