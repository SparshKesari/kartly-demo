import { ApiError, handler, ok } from "@/lib/api";
import { categoryMap, findProductBySlug, productReviews, relatedProducts } from "@/lib/catalog";
import { read } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_req: Request, { params }: { params: { slug: string } }) => {
  const db = read();
  const product = findProductBySlug(db, params.slug);
  if (!product) throw new ApiError(404, "not_found", "Product not found.");
  const category = categoryMap(db).get(product.categoryId);
  return ok({
    product,
    category,
    reviews: productReviews(db, product.id),
    related: relatedProducts(db, product),
  });
});
