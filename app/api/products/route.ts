import { ApiError, handler, ok, validationError } from "@/lib/api";
import { parseListingStrict, searchProducts } from "@/lib/catalog";
import { read } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = parseListingStrict(params);
  if (!parsed.ok) throw validationError(parsed.error);
  const db = read();
  if (parsed.query.category && !db.categories.some((c) => c.slug === parsed.query.category)) {
    throw new ApiError(404, "not_found", "Category not found.");
  }
  return ok(searchProducts(db, parsed.query));
});
