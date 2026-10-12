import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/RegisterForm";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/util";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNextPath(searchParams.next, "/");
  if (getCurrentUser()) redirect(next);
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <RegisterForm next={next} />
    </div>
  );
}
