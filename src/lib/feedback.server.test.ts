/* Smoke test: AI feedback pipeline generates and stores source='ai' reports. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION = {
  id: "s1",
  track: "pm",
  user_a_id: "u1",
  user_b_id: "u2",
  status: "ended",
  question_id: "q1",
  round_1_candidate_id: "u1",
  started_at: null,
  round_swap_at: null,
  ended_at: new Date().toISOString(),
};

const peerRow = (subject: string, rater: string) => ({
  source: "peer",
  subject_user_id: subject,
  rater_user_id: rater,
  structure_score: 4,
  prioritization_score: 3,
  stakeholder_awareness_score: null,
  communication_clarity_score: 5,
  domain_depth_score: 4,
  strengths: ["Clear framing"],
  gaps: ["Name trade-offs"],
});

const inserted: Record<string, unknown>[] = [];

function tableStub(table: string) {
  const result =
    table === "feedback_reports"
      ? { data: [peerRow("u1", "u2"), peerRow("u2", "u1")], error: null }
      : table === "questions"
        ? { data: { prompt_text: "Design a referral program." }, error: null }
        : { data: { track: "pm", experience_level: "mid" }, error: null };

  const builder: Record<string, unknown> = {};
  const chain = new Proxy(builder, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
      }
      if (prop === "maybeSingle") return async () => result;
      if (prop === "insert") {
        return async (row: Record<string, unknown>) => {
          inserted.push({ table, ...row });
          return { data: null, error: null };
        };
      }
      return () => chain;
    },
  });
  return chain;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => tableStub(table) },
}));

vi.mock("@/lib/session.server", () => ({
  loadSession: vi.fn().mockResolvedValue(SESSION),
  assertParticipant: vi.fn(),
}));
vi.mock("./session.server", () => ({
  loadSession: vi.fn().mockResolvedValue(SESSION),
  assertParticipant: vi.fn(),
}));

const aiPayload = {
  structure_score: 4,
  prioritization_score: 3,
  stakeholder_awareness_score: null,
  communication_clarity_score: 5,
  domain_depth_score: 4,
  ai_summary_text: "You framed the problem clearly but skipped the trade-offs.",
  strengths: ["Clear framing"],
  gaps: ["Name the trade-offs"],
};

describe("AI feedback generation", () => {
  beforeEach(() => {
    inserted.length = 0;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls the configured LLM provider and stores one source='ai' report per participant", async () => {
    vi.stubEnv("LLM_PROVIDER", "lovable");
    vi.stubEnv("LOVABLE_API_KEY", "test-key");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(aiPayload) } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { maybeGenerateAiReports } = await import("./feedback.server");
    const result = await maybeGenerateAiReports("s1");

    expect(result).toEqual({ generated: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
    expect((init.headers as Record<string, string>)["Lovable-API-Key"]).toBe("test-key");

    expect(inserted).toHaveLength(2);
    for (const row of inserted) {
      expect(row['table']).toBe("feedback_reports");
      expect(row['source']).toBe("ai");
      expect(row['session_id']).toBe("s1");
      expect(row['rater_user_id']).toBeNull();
      expect(row['ai_summary_text']).toBe(aiPayload.ai_summary_text);
    }
    expect(inserted.map((r) => r['subject_user_id']).sort()).toEqual(["u1", "u2"]);
  });

  it("switches provider endpoint when LLM_PROVIDER=openai", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(aiPayload) } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { generateFeedback } = await import("./generate-feedback.server");
    const out = await generateFeedback({
      track: "pm",
      experienceLevel: "mid",
      prompt: "Design a referral program.",
      peerRatings: [],
    });

    expect(out.ai_summary_text).toBe(aiPayload.ai_summary_text);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/chat/completions");
  });
});
