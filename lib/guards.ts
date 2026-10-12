import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import type { User } from "./types";

/** For server pages: returns the signed-in user or redirects to /login?next=<path>. */
export function requirePageUser(nextPath: string): User {
  const user = getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export function demoAccountsVisible(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.KARTLY_ALLOW_RESET === "1";
}
