import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { read } from "./db";
import type { DB, PublicUser, User } from "./types";

export const SESSION_COOKIE = "kartly_session";
export const GUEST_COOKIE = "kartly_guest";
export const SESSION_DAYS = 7;

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(80, "Name is too long."),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Enter your email.").max(200),
  password: z.string().min(1, "Enter your password.").max(128),
});

export function publicUser(u: User): PublicUser {
  return { id: u.id, name: u.name, email: u.email };
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function userForToken(db: DB, token: string | undefined): User | null {
  if (!token) return null;
  const session = db.sessions.find((s) => s.token === token);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  const user = db.users.find((u) => u.id === session.userId);
  if (!user || user.status !== "active") return null;
  return user;
}

/** Current signed-in user from the request cookies, or null. */
export function getCurrentUser(): User | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return userForToken(read(), token);
}

export function getGuestId(): string | undefined {
  return cookies().get(GUEST_COOKIE)?.value;
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: false,
};

export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, { ...cookieBase, maxAge: SESSION_DAYS * 24 * 3600 });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

export function setGuestCookie(guestId: string) {
  cookies().set(GUEST_COOKIE, guestId, { ...cookieBase, maxAge: 30 * 24 * 3600 });
}

export function clearGuestCookie() {
  cookies().set(GUEST_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

export function createSession(db: DB, userId: string): string {
  const token = newToken();
  const now = new Date();
  db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > now.getTime());
  db.sessions.push({
    token,
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_DAYS * 24 * 3600 * 1000).toISOString(),
  });
  return token;
}
