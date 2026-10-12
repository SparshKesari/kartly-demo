import { z } from "zod";
import { handler, ok, parseInput } from "@/lib/api";
import { read } from "@/lib/db";
import { listOrders } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.union([z.literal(""), z.literal("all"), z.enum(["placed", "shipped", "delivered", "cancelled"])]).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
});

export const GET = handler(async (req: Request) => {
  const user = requireUser();
  const input = parseInput(Object.fromEntries(new URL(req.url).searchParams.entries()), schema);
  const status = input.status && input.status !== "all" ? input.status : undefined;
  return ok(listOrders(read(), user.id, status, input.page));
});
