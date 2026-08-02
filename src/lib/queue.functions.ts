import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getQueueStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ track: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { countWaitingInTrack } = await import("./queue.server");
    return { waiting: await countWaitingInTrack(data.track, context.userId) };
  });

export const widenSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ entryId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertOwnsEntry, runMatch } = await import("./queue.server");
    await assertOwnsEntry(context.supabase, data.entryId, context.userId);
    return { sessionId: await runMatch(data.entryId, true) };
  });
