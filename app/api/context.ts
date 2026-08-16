import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { authenticateRequest } from "./kimi/auth";

// Never Pick/keep passwordHash on ctx.user — every procedure that returns
// ctx.user (or spreads it) straight to the client (auth.me, etc.) would leak
// it otherwise. authenticateRequest already strips it at the source; this
// type is what makes that a compile-time guarantee, not just convention.
export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: Omit<User, "passwordHash">;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch {
    // Authentication is optional here
  }
  return ctx;
}
