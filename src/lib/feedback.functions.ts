import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scoreField = z.number().int().min(1).max(5).nullable();

const peerSchema = z.object({
  sessionId: z.string().uuid(),
  structure_score: scoreField,
  prioritization_score: scoreField,
  stakeholder_awareness_score: scoreField,
  communication_clarity_score: scoreField,
  domain_depth_score: scoreField,
  strengths: z.array(z.string().min(1).max(300)).max(6),
  gaps: z.array(z.string().min(1).max(300)).max(6),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => peerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { submitPeerFeedback } = await import("./feedback.server");
    const { sessionId, ...submission } = data;
    return submitPeerFeedback(sessionId, context.userId, submission);
  });

export const ensureAiReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { loadSession, assertParticipant } = await import("./session.server");
    const { maybeGenerateAiReports } = await import("./feedback.server");
    const session = await loadSession(data.sessionId);
    assertParticipant(session, context.userId);
    return maybeGenerateAiReports(data.sessionId);
  });
