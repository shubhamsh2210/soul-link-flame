import { loadSession, assertParticipant } from "./session.server";
import { mintRoomToken, roomNameFor } from "./livekit.server";

export async function buildRoomPayload(sessionId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let session = await loadSession(sessionId);
  assertParticipant(session, userId);

  // First participant to open the room moves matched -> room_created and starts the clock.
  if (session.status === "matched") {
    const { data } = await supabaseAdmin
      .from("interview_sessions")
      .update({ status: "room_created", started_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "matched")
      .select("*")
      .maybeSingle();
    if (data) session = data as typeof session;
    else session = await loadSession(sessionId);
  }

  const peerId = session.user_a_id === userId ? session.user_b_id : session.user_a_id;
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id,display_name")
    .in("id", [userId, peerId]);

  const me = profiles?.find((p) => p.id === userId);
  const peer = profiles?.find((p) => p.id === peerId);

  let question: { prompt_text: string; difficulty: string } | null = null;
  if (session.question_id) {
    const { data } = await supabaseAdmin
      .from("questions")
      .select("prompt_text,difficulty")
      .eq("id", session.question_id)
      .maybeSingle();
    question = data ?? null;
  }

  const { token, url } = await mintRoomToken(sessionId, userId, me?.display_name ?? "Peer");

  return {
    token,
    serverUrl: url,
    roomName: roomNameFor(sessionId),
    peerName: peer?.display_name ?? "Your peer",
    isRound1Candidate: session.round_1_candidate_id === userId,
    question,
    session: {
      id: session.id,
      status: session.status,
      startedAt: session.started_at,
      roundSwapAt: session.round_swap_at,
      endedAt: session.ended_at,
    },
  };
}
