import { loadSession, assertParticipant } from "./session.server";
import { generateFeedback, type FeedbackInput } from "./generate-feedback.server";

const AI_TIMEOUT_MINUTES = 10;

export type PeerSubmission = {
  structure_score: number | null;
  prioritization_score: number | null;
  stakeholder_awareness_score: number | null;
  communication_clarity_score: number | null;
  domain_depth_score: number | null;
  strengths: string[];
  gaps: string[];
};

export async function submitPeerFeedback(
  sessionId: string,
  raterId: string,
  submission: PeerSubmission,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const session = await loadSession(sessionId);
  assertParticipant(session, raterId);

  const subjectId = session.user_a_id === raterId ? session.user_b_id : session.user_a_id;

  const { data: existing } = await supabaseAdmin
    .from("feedback_reports")
    .select("id")
    .eq("session_id", sessionId)
    .eq("rater_user_id", raterId)
    .eq("source", "peer")
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("feedback_reports")
      .update({ ...submission, subject_user_id: subjectId })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("feedback_reports").insert({
      session_id: sessionId,
      subject_user_id: subjectId,
      rater_user_id: raterId,
      source: "peer",
      ...submission,
    });
  }

  await maybeGenerateAiReports(sessionId);
  return { ok: true };
}

/**
 * Runs once both peer forms are in, or after the 10-minute timeout.
 * Writes one source='ai' report per participant.
 */
export async function maybeGenerateAiReports(sessionId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const session = await loadSession(sessionId);

  const { data: reports } = await supabaseAdmin
    .from("feedback_reports")
    .select("*")
    .eq("session_id", sessionId);

  const rows = reports ?? [];
  const peerRows = rows.filter((r) => r.source === "peer");
  const aiRows = rows.filter((r) => r.source === "ai");
  if (aiRows.length >= 2) return { generated: false, reason: "already-generated" };

  const endedAt = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  const timedOut = Date.now() - endedAt > AI_TIMEOUT_MINUTES * 60 * 1000;
  if (peerRows.length < 2 && !timedOut) return { generated: false, reason: "waiting-for-peers" };

  let promptText: string | null = null;
  if (session.question_id) {
    const { data: q } = await supabaseAdmin
      .from("questions")
      .select("prompt_text")
      .eq("id", session.question_id)
      .maybeSingle();
    promptText = q?.prompt_text ?? null;
  }

  for (const subjectId of [session.user_a_id, session.user_b_id]) {
    if (aiRows.some((r) => r.subject_user_id === subjectId)) continue;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("track,experience_level")
      .eq("id", subjectId)
      .maybeSingle();

    const input: FeedbackInput = {
      track: profile?.track ?? session.track,
      experienceLevel: profile?.experience_level ?? "mid",
      prompt: promptText,
      peerRatings: peerRows
        .filter((r) => r.subject_user_id === subjectId)
        .map((r) => ({
          structure_score: r.structure_score,
          prioritization_score: r.prioritization_score,
          stakeholder_awareness_score: r.stakeholder_awareness_score,
          communication_clarity_score: r.communication_clarity_score,
          domain_depth_score: r.domain_depth_score,
          strengths: r.strengths,
          gaps: r.gaps,
        })),
    };

    const generated = await generateFeedback(input);
    await supabaseAdmin.from("feedback_reports").insert({
      session_id: sessionId,
      subject_user_id: subjectId,
      rater_user_id: null,
      source: "ai",
      structure_score: generated.structure_score,
      prioritization_score: generated.prioritization_score,
      stakeholder_awareness_score: generated.stakeholder_awareness_score,
      communication_clarity_score: generated.communication_clarity_score,
      domain_depth_score: generated.domain_depth_score,
      ai_summary_text: generated.ai_summary_text,
      strengths: generated.strengths,
      gaps: generated.gaps,
    });
  }

  return { generated: true };
}
