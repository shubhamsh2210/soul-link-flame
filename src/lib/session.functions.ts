import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sessionInput = z.object({ sessionId: z.string().uuid() });

export const getSessionRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sessionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { buildRoomPayload } = await import("./session-room.server");
    return buildRoomPayload(data.sessionId, context.userId);
  });

export const advanceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    sessionInput
      .extend({
        from: z.enum(["matched", "room_created", "round_1", "round_swap", "round_2"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { advance } = await import("./session.server");
    const row = await advance(data.sessionId, context.userId, data.from);
    return { status: row.status };
  });

export const checkNoShow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sessionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { runNoShowCheck } = await import("./no-show.server");
    return runNoShowCheck(data.sessionId, context.userId);
  });
