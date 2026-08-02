/**
 * Single LLM abstraction for the whole app.
 * Swap providers with the LLM_PROVIDER env var ("lovable" | "openai" | "anthropic").
 * No keys are ever hardcoded — every provider reads its key from the environment.
 */

export type FeedbackDimensions = {
  structure_score: number | null;
  prioritization_score: number | null;
  stakeholder_awareness_score: number | null;
  communication_clarity_score: number | null;
  domain_depth_score: number | null;
};

export type GeneratedFeedback = FeedbackDimensions & {
  ai_summary_text: string;
  strengths: string[];
  gaps: string[];
};

const RUBRIC_SYSTEM_PROMPT = `You are an interview coach synthesising peer feedback from a mock interview.

You will receive: the candidate's track, the interview prompt, and one or more peer
ratings across five dimensions (1-5, or null when the peer saw no evidence), plus
free-text strengths and gaps.

Rate each dimension 1-5 using this rubric:
1 = no usable evidence of the skill; 2 = attempted but unreliable;
3 = competent for the level; 4 = consistently strong; 5 = exemplary, hire-bar-setting.
Use null only when neither the peer notes nor the transcript summary give any evidence.

Dimensions:
- structure: does the answer follow a clear, signposted framework end to end?
- prioritization: does the candidate make and defend trade-offs instead of listing options?
- stakeholder_awareness: does the candidate account for users, partners and constraints?
- communication_clarity: concise, well-paced, easy to follow, checks for alignment.
- domain_depth: role-appropriate technical or functional depth.

Be specific and behavioural. Never invent details that are not supported by the input.
Write the summary in second person ("you"), 3-5 sentences, direct and actionable.
Return 2-4 strengths and 2-4 gaps, each a single short sentence.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "structure_score",
    "prioritization_score",
    "stakeholder_awareness_score",
    "communication_clarity_score",
    "domain_depth_score",
    "ai_summary_text",
    "strengths",
    "gaps",
  ],
  properties: {
    structure_score: { type: ["integer", "null"], minimum: 1, maximum: 5 },
    prioritization_score: { type: ["integer", "null"], minimum: 1, maximum: 5 },
    stakeholder_awareness_score: { type: ["integer", "null"], minimum: 1, maximum: 5 },
    communication_clarity_score: { type: ["integer", "null"], minimum: 1, maximum: 5 },
    domain_depth_score: { type: ["integer", "null"], minimum: 1, maximum: 5 },
    ai_summary_text: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
  },
} as const;

export type FeedbackInput = {
  track: string;
  experienceLevel: string;
  prompt: string | null;
  peerRatings: Array<
    Partial<FeedbackDimensions> & { strengths?: string[] | null; gaps?: string[] | null }
  >;
};

function userMessage(input: FeedbackInput) {
  return JSON.stringify(input, null, 2);
}

export async function generateFeedback(input: FeedbackInput): Promise<GeneratedFeedback> {
  const provider = (process.env["LLM_PROVIDER"] ?? "lovable").toLowerCase();
  switch (provider) {
    case "openai":
      return callOpenAiCompatible(
        "https://api.openai.com/v1/chat/completions",
        { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` },
        process.env["LLM_MODEL"] ?? "gpt-4o-mini",
        input,
      );
    case "lovable":
    default:
      return callOpenAiCompatible(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        { "Lovable-API-Key": requireEnv("LOVABLE_API_KEY") },
        process.env["LLM_MODEL"] ?? "openai/gpt-5.6-sol",
        input,
        { reasoning_effort: "none" },
      );
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function callOpenAiCompatible(
  url: string,
  authHeaders: Record<string, string>,
  model: string,
  input: FeedbackInput,
  extra: Record<string, unknown> = {},
): Promise<GeneratedFeedback> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: RUBRIC_SYSTEM_PROMPT },
        { role: "user", content: userMessage(input) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "feedback", strict: true, schema: RESPONSE_SCHEMA },
      },
      ...extra,
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit reached — try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned an empty response");
  return JSON.parse(content) as GeneratedFeedback;
}
