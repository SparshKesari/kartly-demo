import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { clearGuestCookie, createSession, getGuestId, loginSchema, publicUser, setSessionCookie, verifyPassword } from "@/lib/auth";
import { mergeGuestCart } from "@/lib/cart";
import { mutate, read } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BAD_CREDENTIALS = "Incorrect email or password.";

export const POST = handler(async (req: Request) => {
  const input = await parseBody(req, loginSchema);
  const candidate = read().users.find((u) => u.email.toLowerCase() === input.email);
  if (!candidate || !verifyPassword(input.password, candidate.passwordHash)) {
    throw new ApiError(401, "invalid_credentials", BAD_CREDENTIALS);
  }
  if (candidate.status === "locked") {
    throw new ApiError(401, "account_locked", "This account is locked.");
  }
  const guestId = getGuestId();
  const result = await mutate((db) => {
    const user = db.users.find((u) => u.id === candidate.id);
    if (!user) throw new ApiError(401, "invalid_credentials", BAD_CREDENTIALS);
    const mergedCount = mergeGuestCart(db, guestId, user.id);
    const token = createSession(db, user.id);
    return { user: publicUser(user), token, mergedCount };
  });
  setSessionCookie(result.token);
  if (guestId) clearGuestCookie();
  return ok({ user: result.user, mergedCount: result.mergedCount });
});
