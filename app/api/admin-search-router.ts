import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { globalSearch } from "./queries/adminSearch";

export type { AdminSearchResult } from "./queries/adminSearch";

// publicQuery (not adminQuery), matching admin-router.ts's own convention —
// there's no real login gate in front of /admin/* in this app.
export const adminSearchRouter = createRouter({
  search: publicQuery.input(z.object({ query: z.string() })).query(({ input }) => globalSearch(input.query)),
});
