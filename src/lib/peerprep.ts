export const TRACKS = [
  { value: "pm", label: "Product Management" },
  { value: "swe", label: "Software Engineering" },
  { value: "consulting", label: "Consulting" },
  { value: "sales", label: "Sales" },
  { value: "support", label: "Customer Support" },
] as const;

export const LEVELS = [
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
] as const;

export type Track = (typeof TRACKS)[number]["value"];
export type Level = (typeof LEVELS)[number]["value"];

export const trackLabel = (v: string) => TRACKS.find((t) => t.value === v)?.label ?? v;
export const levelLabel = (v: string) => LEVELS.find((l) => l.value === v)?.label ?? v;

export const DIMENSIONS = [
  { key: "structure_score", label: "Structure" },
  { key: "prioritization_score", label: "Prioritization / Judgment" },
  { key: "stakeholder_awareness_score", label: "Stakeholder Awareness" },
  { key: "communication_clarity_score", label: "Communication Clarity" },
  { key: "domain_depth_score", label: "Role / Domain Depth" },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];

export const ROUND_SECONDS = 25 * 60;
export const NO_SHOW_GRACE_SECONDS = 3 * 60;
export const QUEUE_WIDEN_AFTER_SECONDS = 30;
