import { maybeGenerateAiReports } from "./feedback.server";

/** Generates AI reports for sessions whose 10-minute peer-feedback window has lapsed. */
export async function finalizeStaleFeedback() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("interview_sessions")
    .select("id")
    .eq("status", "ended")
    .lt("ended_at", cutoff)
    .gt("ended_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(25);

  let finalized = 0;
  for (const row of data ?? []) {
    try {
      const res = await maybeGenerateAiReports(row.id);
      if (res.generated) finalized += 1;
    } catch {
      /* keep sweeping */
    }
  }
  return { finalized };
}
