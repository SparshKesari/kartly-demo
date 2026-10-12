import { handler, ok, parseBody } from "@/lib/api";
import { verifyOtp, verifyOtpSchema } from "@/lib/payments";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const user = requireUser();
  const input = await parseBody(req, verifyOtpSchema);
  const result = await verifyOtp(user.id, input.paymentId, input.otp);
  return ok(result, 201);
});
