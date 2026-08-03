import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQuery } from "@/test/helpers";

const aiReport = {
  id: "r1",
  source: "ai",
  subject_user_id: "u1",
  ai_summary_text: "Strong structure, thin on stakeholder trade-offs.",
  strengths: ["Clear framing"],
  gaps: ["Name the trade-offs"],
  structure_score: 4,
  prioritization_score: 3,
  stakeholder_awareness_score: 2,
  communication_clarity_score: 5,
  domain_depth_score: 4,
};

vi.mock("@tanstack/react-router", async () =>
  (await import("@/test/helpers")).routerMock({ sessionId: "s1" }),
);

vi.mock("@/integrations/supabase/client", async () => {
  const { queryResult } = await import("@/test/helpers");
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
        signOut: vi.fn(),
      },
      from: () => queryResult([aiReport]),
    },
  };
});

vi.mock("@/lib/feedback.functions", () => ({
  ensureAiReport: vi.fn().mockResolvedValue({ ok: true }),
  submitFeedback: vi.fn(),
}));

const { Route } = await import("@/routes/_authenticated/report.$sessionId");
const Page = (Route as unknown as { component: React.ComponentType }).component;

describe("report screen smoke", () => {
  it("renders the report with breakdown and focus callout", async () => {
    renderWithQuery(<Page />);
    expect(await screen.findByRole("heading", { name: /how that round went/i })).toBeInTheDocument();
    expect(screen.getByText(/breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/stakeholder awareness/i)).toBeInTheDocument();
    expect(screen.getByText(/strong structure/i)).toBeInTheDocument();
  });
});
