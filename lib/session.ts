import { ApiError } from "./api";
import { getCurrentUser, getGuestId, newId, setGuestCookie } from "./auth";
import type { CartOwner } from "./cart";
import type { User } from "./types";

export function requireUser(): User {
  const user = getCurrentUser();
  if (!user) throw new ApiError(401, "unauthorized", "Please sign in to continue.");
  return user;
}

/** The cart owner for this request: the signed-in user, or the guest cookie (if any). */
export function currentOwner(): CartOwner {
  const user = getCurrentUser();
  if (user) return { userId: user.id };
  const guestId = getGuestId();
  return guestId ? { guestId } : {};
}

/** Like currentOwner, but creates a guest id (and cookie) for guests without one. */
export function ensureOwner(): CartOwner {
  const owner = currentOwner();
  if (owner.userId || owner.guestId) return owner;
  const guestId = newId("g");
  setGuestCookie(guestId);
  return { guestId };
}
