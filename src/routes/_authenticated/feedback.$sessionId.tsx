import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { submitFeedback } from "@/lib/feedback.functions";
import { getSessionPeer } from "@/lib/session.functions";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader } from "@/components/AppHeader";
import { DIMENSIONS, type DimensionKey } from "@/lib/peerprep";

export const Route = createFileRoute("/_authenticated/feedback/$sessionId")({
  head: () => ({
    meta: [
      { title: "Rate your peer — PeerPrep" },
      { name: "description", content: "Score your peer across five interview dimensions." },
      { property: "og:title", content: "Rate your peer — PeerPrep" },
      { property: "og:description", content: "Structured peer feedback after a mock interview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedbackPage,
});

type Scores = Record<DimensionKey, number | null>;

const EMPTY: Scores = {
  structure_score: null,
  prioritization_score: null,
  stakeholder_awareness_score: null,
  communication_clarity_score: null,
  domain_depth_score: null,
};

function FeedbackPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [scores, setScores] = useState<Scores>(EMPTY);
  const [strengths, setStrengths] = useState("");
  const [gaps, setGaps] = useState("");
  const [peerName, setPeerName] = useState("your peer");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSessionPeer({ data: { sessionId } })
      .then((res) => {
        if (!cancelled && res.peerName) setPeerName(res.peerName);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionId]);


  const toLines = (v: string) =>
    v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);

  async function submit() {
    setBusy(true);
    try {
      await submitFeedback({
        data: {
          sessionId,
          ...scores,
          strengths: toLines(strengths),
          gaps: toLines(gaps),
        },
      });
      toast.success("Feedback sent");
      navigate({ to: "/report/$sessionId", params: { sessionId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-hero min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold">How did {peerName} do?</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Rate only what you actually saw. Leave a dimension blank if there wasn't enough evidence.
        </p>

        <div className="mt-8 space-y-4">
          {DIMENSIONS.map((dim) => (
            <div key={dim.key} className="surface-panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">{dim.label}</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setScores((s) => ({ ...s, [dim.key]: s[dim.key] === n ? null : n }))
                      }
                      className={`h-9 w-9 rounded-md border text-sm font-semibold transition-colors ${
                        scores[dim.key] === n
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-secondary"
                      }`}
                      aria-label={`${dim.label}: ${n}`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setScores((s) => ({ ...s, [dim.key]: null }))}
                    className={`rounded-md border px-3 py-2 text-xs transition-colors ${
                      scores[dim.key] === null
                        ? "border-accent text-accent"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    No evidence
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor="strengths">
              Strengths (one per line)
            </label>
            <Textarea
              id="strengths"
              className="mt-2"
              rows={3}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder={"Clear opening framework\nGood pushback on scope"}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="gaps">
              Gaps (one per line)
            </label>
            <Textarea
              id="gaps"
              className="mt-2"
              rows={3}
              value={gaps}
              onChange={(e) => setGaps(e.target.value)}
              placeholder={"Jumped to solutions before sizing the problem"}
            />
          </div>
        </div>

        <Button size="lg" className="mt-8" onClick={submit} disabled={busy}>
          Submit feedback
        </Button>
      </main>
    </div>
  );
}
