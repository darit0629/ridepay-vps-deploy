import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { corporateMemberships, users } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const corporateRouter = createRouter({
  getMine: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const row = await db.query.corporateMemberships.findFirst({ where: eq(corporateMemberships.userId, ctx.user.id) });
    return row ?? null;
  }),

  applyCorporate: authedQuery
    .input(
      z.object({
        companyName: z.string().trim().min(2).max(150),
        gstin: z.string().trim().max(20).optional(),
        contactPerson: z.string().trim().min(2).max(100),
        contactPhone: z.string().trim().min(8).max(15),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db.query.corporateMemberships.findFirst({ where: eq(corporateMemberships.userId, ctx.user.id) });
      if (existing && existing.status !== "rejected") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a corporate application on file." });
      }
      if (existing) {
        // Re-applying after a rejection — same upsert-by-delete-then-insert
        // shape UserProfile.tsx already uses for saved places.
        await db.delete(corporateMemberships).where(eq(corporateMemberships.userId, ctx.user.id));
      }
      await db.insert(corporateMemberships).values({ userId: ctx.user.id, ...input, status: "pending" });
      return { success: true };
    }),

  // Admin: approval queue, same operational shape as school-router.ts's
  // listAllSubscriptions/verifySubscription.
  listAll: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(corporateMemberships).orderBy(desc(corporateMemberships.createdAt));
    return Promise.all(
      rows.map(async (row) => {
        const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
        return { ...row, riderName: user?.name ?? null, riderPhone: user?.phone ?? null };
      })
    );
  }),

  review: adminQuery
    .input(z.object({ id: z.number(), action: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const row = await db.query.corporateMemberships.findFirst({ where: eq(corporateMemberships.id, input.id) });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found." });
      await db
        .update(corporateMemberships)
        .set({
          status: input.action === "approve" ? "active" : "rejected",
          adminNote: input.note,
          approvedAt: input.action === "approve" ? new Date() : null,
        })
        .where(eq(corporateMemberships.id, input.id));
      return { success: true };
    }),
});
