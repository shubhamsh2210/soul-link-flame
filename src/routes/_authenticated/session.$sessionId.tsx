import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { advanceSession, checkNoShow, getSessionRoom } from "@/lib/session.functions";
import { Button } from "@/components/ui/button";
import { ROUND_SECONDS, NO_SHOW_GRACE_SECONDS } from "@/lib/peerprep";

export const Route = createFileRoute("/_authenticated/session/$sessionId")({
  head: () => ({
    meta: [
      { title: "Live interview room — PeerPrep" },
      { name: "description", content: "Your two-round reciprocal mock interview room." },
      { property: "og:title", content: "Live interview room — PeerPrep" },
      { property: "og:description", content: "Two 25-minute rounds with a matched peer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SessionPage,
});

type Status = "matched" | "room_created" | "round_1" | "round_swap" | "round_2" | "ended" | "no_show";

function SessionPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["session-room", sessionId],
    queryFn: () => getSessionRoom({ data: { sessionId } }),
    retry: false,
  });

  useEffect(() => {
    if (data) setStatus(data.session.status as Status);
  }, [data]);

  // Realtime status sync so both sides move through the state machine together.
  useEffect(() => {
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "interview_sessions", filter: `id=eq.${sessionId}` },
        (payload) => setStatus((payload.new as { status: Status }).status),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (status === "ended") navigate({ to: "/feedback/$sessionId", params: { sessionId } });
    if (status === "no_show") toast.error("Your peer didn't show up. Your credit has been refunded.");
  }, [status, navigate, sessionId]);

  if (isLoading) {
    return <Centered>Setting up your room…</Centered>;
  }
  if (error || !data) {
    return <Centered>{error instanceof Error ? error.message : "Room unavailable"}</Centered>;
  }
  if (status === "no_show") {
    return (
      <Centered>
        <p className="mb-4">Your peer never joined. You've been refunded a credit.</p>
        <Button onClick={() => navigate({ to: "/queue" })}>Back to queue</Button>
      </Centered>
    );
  }

  return (
    <LiveKitRoom
      token={data.token}
      serverUrl={data.serverUrl}
      connect
      video
      audio
      data-lk-theme="default"
      style={{ height: "100dvh" }}
    >
      <RoomStage
        sessionId={sessionId}
        status={status ?? "room_created"}
        peerName={data.peerName}
        isRound1Candidate={data.isRound1Candidate}
        question={data.question}
        startedAt={data.session.startedAt}
        roundSwapAt={data.session.roundSwapAt}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function RoomStage({
  sessionId,
  status,
  peerName,
  isRound1Candidate,
  question,
  startedAt,
  roundSwapAt,
}: {
  sessionId: string;
  status: Status;
  peerName: string;
  isRound1Candidate: boolean;
  question: { prompt_text: string; difficulty: string } | null;
  startedAt: string | null;
  roundSwapAt: string | null;
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const advance = useCallback(
    async (from: Status) => {
      setBusy(true);
      try {
        await advanceSession({ data: { sessionId, from: from as never } });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not advance the session");
      } finally {
        setBusy(false);
      }
    },
    [sessionId],
  );

  // No-show sweep from the client that is present in the room.
  useEffect(() => {
    if (status !== "room_created" || !startedAt) return;
    const elapsed = (now - new Date(startedAt).getTime()) / 1000;
    if (elapsed < NO_SHOW_GRACE_SECONDS) return;
    void checkNoShow({ data: { sessionId } }).catch(() => undefined);
  }, [status, startedAt, now, sessionId]);

  const iAmCandidate =
    status === "round_1" ? isRound1Candidate : status === "round_2" ? !isRound1Candidate : false;

  const roundStart =
    status === "round_1" ? startedAt : status === "round_2" ? roundSwapAt : null;
  const remaining =
    roundStart && (status === "round_1" || status === "round_2")
      ? Math.max(0, ROUND_SECONDS - Math.floor((now - new Date(roundStart).getTime()) / 1000))
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-border/60 bg-background flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent">
            {status === "round_1" ? "Round 1" : status === "round_2" ? "Round 2" : status === "round_swap" ? "Swap" : "Waiting room"}
          </p>
          <p className="text-sm font-medium">
            {status === "round_1" || status === "round_2"
              ? iAmCandidate
                ? `You're the candidate — ${peerName} is interviewing you`
                : `You're the interviewer — ask ${peerName} the prompt below`
              : `With ${peerName}`}
          </p>
        </div>
        {remaining !== null && (
          <span className="text-primary text-3xl font-bold tabular-nums">
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </span>
        )}
        <div className="flex gap-2">
          {status === "room_created" && (
            <Button size="sm" disabled={busy} onClick={() => advance("room_created")}>
              Start round 1
            </Button>
          )}
          {status === "round_1" && (
            <Button size="sm" disabled={busy} onClick={() => advance("round_1")}>
              End round 1
            </Button>
          )}
          {status === "round_swap" && (
            <Button size="sm" disabled={busy} onClick={() => advance("round_swap")}>
              Start round 2
            </Button>
          )}
          {status === "round_2" && (
            <Button size="sm" disabled={busy} onClick={() => advance("round_2")}>
              End session
            </Button>
          )}
        </div>
      </div>

      {question && !iAmCandidate && status !== "room_created" && (
        <div className="border-border/60 bg-secondary/30 border-b px-5 py-3">
          <p className="text-muted-foreground text-xs uppercase tracking-wider">
            Prompt ({question.difficulty})
          </p>
          <p className="mt-1 text-sm">{question.prompt_text}</p>
        </div>
      )}

      {status === "round_swap" && (
        <div className="bg-primary/10 px-5 py-3 text-sm">
          Roles swap now — {peerName} becomes the candidate. Take a short break, then start round 2.
        </div>
      )}

      <div className="min-h-0 flex-1">
        <GridLayout tracks={tracks} style={{ height: "100%" }}>
          <ParticipantTile />
        </GridLayout>
      </div>
      <ControlBar variation="minimal" />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-hero flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}
