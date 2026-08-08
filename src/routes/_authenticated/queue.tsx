import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getQueueStats, widenSearch } from "@/lib/queue.functions";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { QUEUE_WIDEN_AFTER_SECONDS, trackLabel, levelLabel } from "@/lib/peerprep";

export const Route = createFileRoute("/_authenticated/queue")({
  head: () => ({
    meta: [
      { title: "Interview queue — PeerPrep" },
      { name: "description", content: "Join the live queue and get matched with a peer in your track." },
      { property: "og:title", content: "Interview queue — PeerPrep" },
      { property: "og:description", content: "Live matching for reciprocal peer mock interviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QueuePage,
});

type Profile = {
  id: string;
  display_name: string;
  track: string;
  experience_level: string;
  credits_balance: number;
  trust_score: number;
  completed_sessions: number;
};

function QueuePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [widened, setWidened] = useState(false);
  const entryRef = useRef<string | null>(null);

  useEffect(() => {
    entryRef.current = entryId;
  }, [entryId]);

  // Load profile (or send to onboarding)
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,track,experience_level,credits_balance,trust_score,completed_sessions")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!data) {
        navigate({ to: "/onboarding", replace: true });
        return;
      }
      setProfile(data as Profile);

      const { data: existing } = await supabase
        .from("queue_entries")
        .select("id")
        .eq("user_id", auth.user.id)
        .eq("status", "waiting")
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) setEntryId(existing.id);

      // Resume an interview that is still in progress.
      const { data: live } = await supabase
        .from("interview_sessions")
        .select("id")
        .in("status", ["matched", "room_created", "round_1", "round_swap", "round_2"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (live) setActiveSessionId(live.id);
    })();
  }, [navigate]);


  const refreshStats = useCallback(async () => {
    if (!profile) return;
    try {
      const res = await getQueueStats({ data: { track: profile.track } });
      setWaiting(res.waiting);
    } catch {
      /* transient */
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    void refreshStats();
    const i = setInterval(refreshStats, 5000);
    return () => clearInterval(i);
  }, [profile, refreshStats]);

  // Elapsed timer while queued
  useEffect(() => {
    if (!entryId) {
      setElapsed(0);
      return;
    }
    const i = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(i);
  }, [entryId]);

  // Realtime: a session involving me was created
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel("session-matches")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "interview_sessions" },
        (payload) => {
          const row = payload.new as { id: string };
          navigate({ to: "/session/$sessionId", params: { sessionId: row.id } });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile, navigate]);

  // Safety net: poll for a match if realtime is delayed
  useEffect(() => {
    if (!entryId || !profile) return;
    const i = setInterval(async () => {
      const { data } = await supabase
        .from("interview_sessions")
        .select("id,status")
        .in("status", ["matched", "room_created", "round_1", "round_swap", "round_2"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) navigate({ to: "/session/$sessionId", params: { sessionId: data.id } });
    }, 4000);
    return () => clearInterval(i);
  }, [entryId, profile, navigate]);

  async function join() {
    if (!profile) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("queue_entries")
        .insert({
          user_id: profile.id,
          track: profile.track,
          experience_level: profile.experience_level,
        })
        .select("id")
        .single();
      if (error) throw error;
      setEntryId(data.id);
      setWidened(false);
      void refreshStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join the queue");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!entryId) return;
    setBusy(true);
    await supabase.from("queue_entries").update({ status: "cancelled" }).eq("id", entryId);
    setEntryId(null);
    setBusy(false);
  }

  async function widen() {
    if (!entryId) return;
    setBusy(true);
    try {
      const res = await widenSearch({ data: { entryId } });
      setWidened(true);
      if (res.sessionId) {
        navigate({ to: "/session/$sessionId", params: { sessionId: res.sessionId } });
      } else {
        toast.message("Search widened to adjacent levels. Still looking…");
      }
    } catch {
      toast.error("Could not widen the search");
    } finally {
      setBusy(false);
    }
  }

  const timedOut = elapsed >= QUEUE_WIDEN_AFTER_SECONDS;

  return (
    <div className="bg-hero min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        {profile && (
          <div className="surface-panel p-8">
            <p className="text-accent text-xs font-semibold uppercase tracking-[0.2em]">
              {trackLabel(profile.track)} · {levelLabel(profile.experience_level)}
            </p>

            {!entryId ? (
              <>
                <h1 className="mt-3 text-3xl font-bold">Ready for a round?</h1>
                <p className="text-muted-foreground mt-3 max-w-lg text-sm leading-relaxed">
                  You'll be paired with another {trackLabel(profile.track).toLowerCase()} candidate.
                  Two 25-minute rounds — you interview them, then they interview you.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <Button size="lg" onClick={join} disabled={busy}>
                    Join queue
                  </Button>
                  <span className="text-muted-foreground text-sm">
                    {waiting} {waiting === 1 ? "other" : "others"} online in your track
                  </span>
                </div>
              </>
            ) : (
              <>
                <h1 className="mt-3 text-3xl font-bold">Looking for your match…</h1>
                <div className="mt-6 flex items-baseline gap-3">
                  <span className="text-primary text-5xl font-bold tabular-nums">
                    {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
                    {String(elapsed % 60).padStart(2, "0")}
                  </span>
                  <span className="text-muted-foreground text-sm">in queue</span>
                </div>
                <p className="text-muted-foreground mt-4 text-sm">
                  {waiting} {waiting === 1 ? "other person is" : "other people are"} waiting in{" "}
                  {trackLabel(profile.track)} right now.
                </p>

                {timedOut && (
                  <div className="border-border bg-secondary/40 mt-6 rounded-lg border p-4">
                    <p className="text-sm font-medium">No exact-level match yet.</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {widened
                        ? "Adjacent experience levels are now included. Hang tight."
                        : "You can widen the search to include adjacent experience levels."}
                    </p>
                    {!widened && (
                      <Button className="mt-4" size="sm" onClick={widen} disabled={busy}>
                        Widen to adjacent levels
                      </Button>
                    )}
                  </div>
                )}

                <Button variant="ghost" className="mt-6" onClick={leave} disabled={busy}>
                  Leave queue
                </Button>
              </>
            )}
          </div>
        )}

        {profile && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <Stat label="Credits" value={profile.credits_balance} />
            <Stat label="Trust score" value={Math.round(profile.trust_score)} />
            <Stat label="Sessions" value={profile.completed_sessions} />
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-panel p-4">
      <p className="text-muted-foreground text-xs uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
