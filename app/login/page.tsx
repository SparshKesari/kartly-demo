import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";
import { demoAccountsVisible } from "@/lib/guards";
import { safeNextPath } from "@/lib/util";

export const metadata: Metadata = { title: "Sign in" };

const DEMO_ACCOUNTS = [
  { email: "alice@kartly.test", note: "Cart, wishlist, 2 addresses, 4 orders" },
  { email: "bob@kartly.test", note: "Empty cart, 1 address, no orders" },
  { email: "carol@kartly.test", note: "Cart with stock problems" },
  { email: "dave@kartly.test", note: "SAVE10 applied, saved for later items" },
  { email: "erin@kartly.test", note: "12 orders" },
  { email: "frank@kartly.test", note: "No addresses, empty cart" },
  { email: "locked@kartly.test", note: "Locked account (sign in fails)" },
];

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNextPath(searchParams.next, "/");
  if (getCurrentUser()) redirect(next);
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <LoginForm next={next} demoAccounts={demoAccountsVisible() ? DEMO_ACCOUNTS : null} />
    </div>
  );
}
