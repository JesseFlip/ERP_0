import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createUploadTarget } from "@/lib/storage";

export const uploadsRouter = router({
  createUploadTarget: protectedProcedure
    .input(z.object({ filename: z.string(), contentType: z.string() }))
    .mutation(({ ctx, input }) => {
      return createUploadTarget(ctx.orgId, input.filename, input.contentType);
    }),
});
