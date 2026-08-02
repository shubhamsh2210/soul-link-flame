import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PeerPrep — Live peer mock interviews with AI feedback" },
      {
        name: "description",
        content:
          "Get matched with a peer in your track, run two reciprocal 25-minute mock interviews, and receive a structured AI-scored feedback report.",
      },
      { property: "og:title", content: "PeerPrep — Live peer mock interviews with AI feedback" },
      {
        property: "og:description",
        content:
          "Get matched with a peer in your track, run two reciprocal 25-minute mock interviews, and receive a structured AI-scored feedback report.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  { n: "01", t: "Join the queue", d: "Pick your track and level. We match on experience, trust and recency." },
  { n: "02", t: "Two rounds, swapped", d: "25 minutes each. You interview them, then they interview you." },
  { n: "03", t: "Structured report", d: "Peer scores across five dimensions, synthesized into an AI report." },
];

function Landing() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="bg-hero min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold tracking-tight">
          Peer<span className="text-primary">Prep</span>
        </span>
        {signedIn ? (
          <Button size="sm" onClick={() => navigate({ to: "/queue" })}>
            Open app
          </Button>
        ) : (
          <Button size="sm" variant="secondary" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-14">
        <p className="text-accent text-xs font-semibold uppercase tracking-[0.2em]">
          Reciprocal mock interviews
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.05] sm:text-6xl">
          Practice with a real peer.
          <br />
          Leave with a real scorecard.
        </h1>
        <p className="text-muted-foreground mt-6 max-w-xl text-lg">
          PeerPrep pairs you with someone in your track, runs two live rounds where
          you swap roles, then turns both sides of the feedback into one structured
          report.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link to={signedIn ? "/queue" : "/auth"}>
              {signedIn ? "Find a match" : "Start practicing"}
            </Link>
          </Button>
        </div>

        <section className="mt-24 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="surface-panel p-6">
              <span className="text-primary text-sm font-bold">{s.n}</span>
              <h2 className="mt-3 text-lg font-semibold">{s.t}</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{s.d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
