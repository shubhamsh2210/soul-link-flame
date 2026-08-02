export async function countWaitingInTrack(track: string, excludeUserId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("queue_entries")
    .select("id", { count: "exact", head: true })
    .eq("track", track)
    .eq("status", "waiting")
    .neq("user_id", excludeUserId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function runMatch(entryId: string, allowAdjacent: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("try_match_queue_entry", {
    _entry_id: entryId,
    _allow_adjacent: allowAdjacent,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export async function assertOwnsEntry(
  supabase: { from: (t: string) => any },
  entryId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("queue_entries")
    .select("id,user_id")
    .eq("id", entryId)
    .maybeSingle();
  if (!data || data.user_id !== userId) throw new Error("Forbidden");
}
