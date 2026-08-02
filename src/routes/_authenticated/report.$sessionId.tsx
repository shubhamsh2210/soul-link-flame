import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { ensureAiReport } from "@/lib/feedback.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { DIMENSIONS, type DimensionKey } from "@/lib/peerprep";

export const Route = createFileRoute("/_authenticated/report/$sessionId")({
  head: () => ({
    meta: [
      { title: "Your interview report — PeerPrep" },
      {
        name: "description",
        content: "Radar breakdown, strengths, gaps and a focus area from your mock interview.",
      },
      { property: "og:title", content: "Your interview report — PeerPrep" },
      { property: "og:description", content: "AI-synthesised feedback from your peer mock interview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

type Report = {
  id: string;
  source: string;
  subject_user_id: string;
  ai_summary_text: string | null;
  strengths: string[] | null;
  gaps: string[] | null;
} & Record<DimensionKey, number | null>;

function ReportPage() {
  const { sessionId } = Route.useParams();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["report", sessionId],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? "";
      const { data: rows } = await supabase
        .from("feedback_reports")
        .select("*")
        .eq("session_id", sessionId);
      const mine = (rows ?? []) as unknown as Report[];
      return {
        userId: uid,
        ai: mine.find((r) => r.source === "ai" && r.subject_user_id === uid) ?? null,
        peer: mine.filter((r) => r.source === "peer" && r.subject_user_id === uid),
      };
    },
    refetchInterval: (q) => (q.state.data?.ai ? false : 5000),
  });

  useEffect(() => {
    void ensureAiReport({ data: { sessionId } })
      .then(() => refetch())
      .catch(() => undefined);
  }, [sessionId, refetch]);

  if (isLoading) return <Shell>Loading your report…</Shell>;

  const ai = data?.ai;
  if (!ai) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Building your report…</h1>
        <p className="text-muted-foreground mt-2 max-w-md text-sm">
          We're waiting on your peer's feedback form. Your report generates automatically as soon as
          it lands (or after 10 minutes).
        </p>
        <Button asChild className="mt-6" variant="ghost">
          <Link to="/queue">Back to queue</Link>
        </Button>
      </Shell>
    );
  }

  const chartData = DIMENSIONS.map((d) => ({
    dimension: d.label,
    score: ai[d.key] ?? 0,
    rated: ai[d.key] !== null,
  }));

  const scored = DIMENSIONS.map((d) => ({ ...d, value: ai[d.key] })).filter(
    (d): d is typeof d & { value: number } => typeof d.value === "number",
  );
  const focus = scored.length
    ? scored.reduce((lowest, d) => (d.value < lowest.value ? d : lowest))
    : null;

  return (
    <div className="bg-hero min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-accent text-xs font-semibold uppercase tracking-[0.2em]">
          Session report
        </p>
        <h1 className="mt-2 text-3xl font-bold">Here's how that round went</h1>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="surface-panel p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData} outerRadius="72%">
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  />
                  <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="score"
                    stroke="var(--color-primary)"
                    fill="var(--color-primary)"
                    fillOpacity={0.35}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface-panel p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider">Breakdown</h2>
            <ul className="mt-4 space-y-3">
              {DIMENSIONS.map((d) => {
                const v = ai[d.key];
                return (
                  <li key={d.key} className="flex items-center justify-between gap-4">
                    <span className="text-sm">{d.label}</span>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${scoreClass(v)}`}
                    >
                      {v === null ? "No evidence" : `${v} / 5`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {focus && (
          <div className="border-accent/40 bg-accent/10 mt-6 rounded-xl border p-6">
            <p className="text-accent text-xs font-semibold uppercase tracking-[0.2em]">
              Focus next
            </p>
            <p className="mt-2 text-lg font-semibold">{focus.label}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              This was your lowest rated dimension at {focus.value}/5. Target it in your next round.
            </p>
          </div>
        )}

        {ai.ai_summary_text && (
          <div className="surface-panel mt-6 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider">Summary</h2>
            <p className="mt-3 text-sm leading-relaxed">{ai.ai_summary_text}</p>
          </div>
        )}

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <ListCard title="Strengths" items={ai.strengths ?? []} tone="good" />
          <ListCard title="Gaps" items={ai.gaps ?? []} tone="warn" />
        </div>

        <Button asChild className="mt-8">
          <Link to="/queue">Queue another round</Link>
        </Button>
      </main>
    </div>
  );
}

function scoreClass(v: number | null) {
  if (v === null) return "bg-secondary text-muted-foreground";
  if (v >= 4) return "bg-primary/20 text-primary";
  if (v === 3) return "bg-accent/20 text-accent";
  return "bg-destructive/20 text-destructive";
}

function ListCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "warn";
}) {
  return (
    <div className="surface-panel p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">Nothing noted.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm">
              <span className={tone === "good" ? "text-primary" : "text-accent"}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-hero min-h-screen">
      <AppHeader />
      <main className="mx-auto flex max-w-2xl flex-col items-start px-6 py-20">{children}</main>
    </div>
  );
}
