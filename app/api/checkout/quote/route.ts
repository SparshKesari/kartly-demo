import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { read } from "@/lib/db";
import { assertCartReady, requireAddress } from "@/lib/payments";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  addressId: z.string().min(1).max(100),
  deliveryOption: z.enum(["standard", "express"]),
});

export const POST = handler(async (req: Request) => {
  const user = requireUser();
  const input = await parseBody(req, schema);
  const db = read();
  const address = requireAddress(db, user.id, input.addressId);
  const { view } = assertCartReady(db, user.id, input.deliveryOption);
  return ok({ address, deliveryOption: input.deliveryOption, cart: view, totals: view.totals });
});
