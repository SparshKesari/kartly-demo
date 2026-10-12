import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { clearGuestCookie, createSession, getGuestId, hashPassword, newId, publicUser, registerSchema, setSessionCookie } from "@/lib/auth";
import { mergeGuestCart } from "@/lib/cart";
import { mutate } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const input = await parseBody(req, registerSchema);
  const guestId = getGuestId();
  const passwordHash = hashPassword(input.password);
  const result = await mutate((db) => {
    if (db.users.some((u) => u.email.toLowerCase() === input.email)) {
      throw new ApiError(409, "conflict", "An account with this email already exists.", { email: "An account with this email already exists." });
    }
    const user = { id: newId("u"), name: input.name, email: input.email, passwordHash, status: "active" as const, createdAt: new Date().toISOString() };
    db.users.push(user);
    db.carts.push({ id: newId("cart"), userId: user.id, items: [], updatedAt: user.createdAt });
    const mergedCount = mergeGuestCart(db, guestId, user.id);
    const token = createSession(db, user.id);
    return { user: publicUser(user), token, mergedCount };
  });
  setSessionCookie(result.token);
  if (guestId) clearGuestCookie();
  return ok({ user: result.user, mergedCount: result.mergedCount }, 201);
});
