import { NO_SHOW_GRACE_SECONDS } from "./peerprep";

export type SessionRow = {
  id: string;
  track: string;
  user_a_id: string;
  user_b_id: string;
  status: string;
  question_id: string | null;
  round_1_candidate_id: string | null;
  started_at: string | null;
  round_swap_at: string | null;
  ended_at: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadSession(sessionId: string): Promise<SessionRow> {
  const db = await admin();
  const { data, error } = await db
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Session not found");
  return data as SessionRow;
}

export function assertParticipant(session: SessionRow, userId: string) {
  if (session.user_a_id !== userId && session.user_b_id !== userId) {
    throw new Error("Forbidden");
  }
}

export type SessionStatus =
  | "matched"
  | "room_created"
  | "round_1"
  | "round_swap"
  | "round_2"
  | "ended"
  | "no_show";

export const NEXT_STATUS: Partial<Record<SessionStatus, SessionStatus>> = {
  matched: "room_created",
  room_created: "round_1",
  round_1: "round_swap",
  round_swap: "round_2",
  round_2: "ended",
};

const TIMESTAMP_FOR: Partial<Record<SessionStatus, "started_at" | "round_swap_at" | "ended_at">> = {
  room_created: "started_at",
  round_swap: "round_swap_at",
  ended: "ended_at",
};

/** Server-authoritative transition. Only the documented next state is allowed. */
export async function advance(sessionId: string, userId: string, expectedFrom: SessionStatus) {
  const db = await admin();
  const session = await loadSession(sessionId);
  assertParticipant(session, userId);

  if (session.status !== expectedFrom) return session; // already advanced by the peer
  const next = NEXT_STATUS[expectedFrom];
  if (!next) throw new Error("Session already finished");

  const patch: {
    status: SessionStatus;
    started_at?: string;
    round_swap_at?: string;
    ended_at?: string;
  } = { status: next };
  const stamp = TIMESTAMP_FOR[next];
  if (stamp) patch[stamp] = new Date().toISOString();

  const { data, error } = await db
    .from("interview_sessions")
    .update(patch)
    .eq("id", sessionId)
    .eq("status", expectedFrom)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (next === "ended") await completeSession(session);
  return (data as SessionRow | null) ?? (await loadSession(sessionId));
}


async function completeSession(session: SessionRow) {
  const db = await admin();
  for (const uid of [session.user_a_id, session.user_b_id]) {
    const { data: p } = await db
      .from("profiles")
      .select("credits_balance,completed_sessions")
      .eq("id", uid)
      .maybeSingle();
    if (!p) continue;
    await db
      .from("profiles")
      .update({
        credits_balance: p.credits_balance + 1,
        completed_sessions: p.completed_sessions + 1,
      })
      .eq("id", uid);
  }
}

/** Marks a session no_show when fewer than 2 people joined within the grace period. */
export async function evaluateNoShow(sessionId: string, participantCount: number) {
  const db = await admin();
  const session = await loadSession(sessionId);
  if (session.status !== "room_created" || !session.started_at) return null;

  const elapsed = (Date.now() - new Date(session.started_at).getTime()) / 1000;
  if (elapsed < NO_SHOW_GRACE_SECONDS) return null;
  if (participantCount >= 2) return null;

  await db.from("interview_sessions").update({
    status: "no_show",
    ended_at: new Date().toISOString(),
  }).eq("id", sessionId).eq("status", "room_created");

  // We cannot tell who joined from the count alone when it is 0; penalise nobody then.
  return { sessionId, penalised: participantCount === 1 };
}

export async function applyNoShowOutcome(
  absenteeId: string | null,
  presentId: string | null,
) {
  const db = await admin();
  if (absenteeId) {
    const { data: p } = await db
      .from("profiles")
      .select("no_show_count,trust_score")
      .eq("id", absenteeId)
      .maybeSingle();
    if (p) {
      await db
        .from("profiles")
        .update({
          no_show_count: p.no_show_count + 1,
          trust_score: Math.max(0, Number(p.trust_score) - 5),
        })
        .eq("id", absenteeId);
    }
  }
  if (presentId) {
    const { data: p } = await db
      .from("profiles")
      .select("credits_balance")
      .eq("id", presentId)
      .maybeSingle();
    if (p) {
      await db
        .from("profiles")
        .update({ credits_balance: p.credits_balance + 1 })
        .eq("id", presentId);
    }
  }
}

/** Peer's display name for a session participant (profiles RLS is own-row only). */
export async function loadPeerName(sessionId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const session = await loadSession(sessionId);
  assertParticipant(session, userId);
  const peerId = session.user_a_id === userId ? session.user_b_id : session.user_a_id;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", peerId)
    .maybeSingle();
  return data?.display_name ?? "your peer";
}
