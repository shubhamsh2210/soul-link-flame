import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery, queryResult } from "@/test/helpers";

const h = vi.hoisted(() => ({
  insert: vi.fn(),
  getQueueStats: vi.fn().mockResolvedValue({ waiting: 3 }),
  widenSearch: vi.fn().mockResolvedValue({ sessionId: null }),
}));

vi.mock("@tanstack/react-router", async () => (await import("@/test/helpers")).routerMock());

vi.mock("@/integrations/supabase/client", async () => {
  const { queryResult: qr } = await import("@/test/helpers");
  const profile = {
    id: "u1",
    display_name: "Ada",
    track: "pm",
    experience_level: "mid",
    credits_balance: 3,
    trust_score: 100,
    completed_sessions: 0,
  };
  return {
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      channel: () => ({ on: function () { return this; }, subscribe: function () { return this; } }),
      removeChannel: vi.fn(),
      from: (table: string) => {
        if (table === "profiles") return qr(profile);
        if (table === "queue_entries") {
          h.insert.mockReturnValue(qr({ id: "entry-1" }));
          const builder = qr(null) as unknown as Record<string, unknown>;
          return new Proxy(builder, {
            get(target, prop) {
              if (prop === "insert") return h.insert;
              return (target as never)[prop];
            },
          });
        }
        return qr(null);
      },
    },
  };
});

vi.mock("@/lib/queue.functions", () => ({
  getQueueStats: h.getQueueStats,
  widenSearch: h.widenSearch,
}));

const { Route } = await import("@/routes/_authenticated/queue");
const Page = (Route as unknown as { component: React.ComponentType }).component;

describe("queue screen smoke", () => {
  it("shows the profile track and live waiting count", async () => {
    renderWithQuery(<Page />);
    expect(await screen.findByRole("heading", { name: /ready for a round/i })).toBeInTheDocument();
    expect(screen.getByText(/product management/i)).toBeInTheDocument();
    await waitFor(() => expect(h.getQueueStats).toHaveBeenCalledWith({ data: { track: "pm" } }));
    expect(await screen.findByText(/3 others online/i)).toBeInTheDocument();
  });

  it("joins the queue and switches to the waiting state", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Page />);
    await user.click(await screen.findByRole("button", { name: /join queue/i }));

    await waitFor(() =>
      expect(h.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: "u1", track: "pm", experience_level: "mid" }),
      ),
    );
    expect(await screen.findByRole("heading", { name: /looking for your match/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leave queue/i })).toBeInTheDocument();
  });
});

void queryResult;
