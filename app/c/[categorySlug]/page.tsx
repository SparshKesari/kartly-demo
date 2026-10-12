import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingPage } from "@/components/ListingPage";
import { parseListingLenient } from "@/lib/catalog";
import { read } from "@/lib/db";

type Props = { params: { categorySlug: string }; searchParams: Record<string, string | string[] | undefined> };

export function generateMetadata({ params }: Props): Metadata {
  const category = read().categories.find((c) => c.slug === params.categorySlug);
  return { title: category ? category.name : "Category not found" };
}

export default function CategoryPage({ params, searchParams }: Props) {
  const category = read().categories.find((c) => c.slug === params.categorySlug);
  if (!category) notFound();
  const query = { ...parseListingLenient(searchParams), category: category.slug };
  return <ListingPage query={query} routeCategory={category.slug} heading={category.name} />;
}
