import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { idempotencyKeySchema, paymentSchema, startPayment } from "@/lib/payments";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const user = requireUser();
  const key = idempotencyKeySchema.safeParse(req.headers.get("Idempotency-Key") ?? "");
  if (!key.success) throw new ApiError(400, "bad_request", "A valid Idempotency-Key header is required.");
  const input = await parseBody(req, paymentSchema);
  return ok(startPayment(user.id, key.data, input));
});
