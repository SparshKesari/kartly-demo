import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";

export type ErrorCode =
  | "bad_request"
  | "validation_error"
  | "unauthorized"
  | "invalid_credentials"
  | "account_locked"
  | "not_found"
  | "conflict"
  | "out_of_stock"
  | "unprocessable"
  | "coupon_invalid"
  | "coupon_expired"
  | "coupon_min_not_met"
  | "card_declined"
  | "card_unsupported"
  | "otp_incorrect"
  | "otp_failed"
  | "payment_failed"
  | "cart_changed"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 404 | 409 | 422 | 500,
    public code: ErrorCode,
    message: string,
    public fields?: Record<string, string>,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status: 200 | 201 = 200, init?: { headers?: HeadersInit }) {
  return NextResponse.json({ data }, { status, headers: init?.headers });
}

/**
 * The Kartly web UI sends this header so that expected business errors (wrong password,
 * declined card, invalid coupon...) come back as HTTP 200 with the usual error envelope and
 * the real status in `status`. Browsers log every 4xx fetch as a console error, and the UI
 * must keep the console clean. Every other client gets the real HTTP status code.
 */
export const SOFT_ERRORS_HEADER = "x-kartly-client";

export function fail(err: ApiError, soft = false) {
  const body = { error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}), ...(err.extra ?? {}) } };
  if (soft && err.status < 500) return NextResponse.json({ ...body, status: err.status }, { status: 200 });
  return NextResponse.json(body, { status: err.status });
}

export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export function validationError(error: ZodError) {
  return new ApiError(400, "validation_error", "Please check the highlighted fields.", zodFields(error));
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "bad_request", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

export function parseInput<S extends ZodTypeAny>(value: unknown, schema: S): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

/** Wraps a route handler so thrown ApiErrors become JSON error responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const req = args[0];
    const soft = req instanceof Request && req.headers.get(SOFT_ERRORS_HEADER) === "web";
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return fail(err, soft);
      if (err instanceof ZodError) return fail(validationError(err), soft);
      console.error("[kartly] unhandled API error", err);
      return fail(new ApiError(500, "internal_error", "Something went wrong. Please try again."));
    }
  };
}
