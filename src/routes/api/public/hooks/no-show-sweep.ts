import { createFileRoute } from "@tanstack/react-router";

/** Constant-time-ish comparison to avoid trivially leaking the expected key. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/no-show-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!expected) {
          console.error("[no-show-sweep] Missing Supabase key for caller verification");
          return new Response(JSON.stringify({ error: "Not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const authHeader = request.headers.get("authorization");
        const provided =
          request.headers.get("apikey") ??
          (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

        if (!provided || !safeEqual(provided, expected)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { sweepNoShows } = await import("@/lib/no-show.server");
        const { finalizeStaleFeedback } = await import("@/lib/feedback-sweep.server");
        const noShow = await sweepNoShows();
        const feedback = await finalizeStaleFeedback();
        return Response.json({ ok: true, ...noShow, ...feedback });
      },
    },
  },
});
