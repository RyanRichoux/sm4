import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

/** Parse untrusted input; throws a 400 with plain messages on failure. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const issues = r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  throw new HttpError(400, issues[0]?.message ?? "Invalid request.", "validation", issues);
}

export const notFound = (what = "Not found.") => new HttpError(404, what, "not_found");
export const forbidden = (msg = "You don't have permission to do that.") => new HttpError(403, msg, "forbidden");
