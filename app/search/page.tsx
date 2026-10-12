import type { Metadata } from "next";
import { ListingPage } from "@/components/ListingPage";
import { parseListingLenient } from "@/lib/catalog";

type Props = { searchParams: Record<string, string | string[] | undefined> };

export function generateMetadata({ searchParams }: Props): Metadata {
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  return { title: q ? `Results for "${q}"` : "All products" };
}

export default function SearchPage({ searchParams }: Props) {
  const query = parseListingLenient(searchParams);
  return <ListingPage query={query} />;
}
