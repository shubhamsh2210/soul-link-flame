import { countRoomParticipants } from "./livekit.server";
import { evaluateNoShow, loadSession, assertParticipant, applyNoShowOutcome } from "./session.server";

/**
 * Called by a present participant (or the cron sweep) once the grace period
 * has elapsed. Marks the session no_show, penalises the absentee and refunds
 * the participant who showed up.
 */
export async function runNoShowCheck(sessionId: string, reporterId: string | null) {
  const session = await loadSession(sessionId);
  if (reporterId) assertParticipant(session, reporterId);

  const count = await countRoomParticipants(sessionId);
  const result = await evaluateNoShow(sessionId, count);
  if (!result) return { noShow: false as const };

  if (reporterId) {
    const absentee =
      session.user_a_id === reporterId ? session.user_b_id : session.user_a_id;
    await applyNoShowOutcome(absentee, reporterId);
  }
  return { noShow: true as const };
}

/** Cron sweep: no reporter, so nobody is refunded unless exactly one joined. */
export async function sweepNoShows() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("interview_sessions")
    .select("id")
    .eq("status", "room_created")
    .lt("started_at", new Date(Date.now() - 3 * 60 * 1000).toISOString())
    .limit(50);

  let marked = 0;
  for (const row of data ?? []) {
    const count = await countRoomParticipants(row.id);
    const result = await evaluateNoShow(row.id, count);
    if (result) marked += 1;
  }
  return { marked };
}
