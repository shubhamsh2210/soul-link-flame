import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/no-show-sweep")({
  server: {
    handlers: {
      POST: async () => {
        const { sweepNoShows } = await import("@/lib/no-show.server");
        const { finalizeStaleFeedback } = await import("@/lib/feedback-sweep.server");
        const noShow = await sweepNoShows();
        const feedback = await finalizeStaleFeedback();
        return Response.json({ ok: true, ...noShow, ...feedback });
      },
    },
  },
});
