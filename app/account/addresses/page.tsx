import type { Metadata } from "next";
import { AddressBook } from "@/components/AddressBook";
import { read } from "@/lib/db";
import { requirePageUser } from "@/lib/guards";

export const metadata: Metadata = { title: "Your Addresses" };

export default function AddressesPage() {
  const user = requirePageUser("/account/addresses");
  const addresses = read()
    .addresses.filter((a) => a.userId === user.id)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return (
    <div className="mx-auto max-w-5xl px-2 py-6 md:px-4">
      <h1 className="mb-4 text-2xl font-semibold">Your Addresses</h1>
      <AddressBook initial={addresses} />
    </div>
  );
}
