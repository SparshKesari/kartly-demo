import { handler, ok, parseBody } from "@/lib/api";
import { addressSchema } from "@/lib/address";
import { newId } from "@/lib/auth";
import { mutate, read } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { Address } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = requireUser();
  const list = read().addresses.filter((a) => a.userId === user.id);
  return ok(list.sort((a, b) => Number(b.isDefault) - Number(a.isDefault)));
});

export const POST = handler(async (req: Request) => {
  const user = requireUser();
  const input = await parseBody(req, addressSchema);
  const address = await mutate((db) => {
    const mine = db.addresses.filter((a) => a.userId === user.id);
    const isDefault = mine.length === 0 || Boolean(input.isDefault);
    if (isDefault) mine.forEach((a) => (a.isDefault = false));
    const created: Address = {
      id: newId("a"),
      userId: user.id,
      fullName: input.fullName,
      phone: input.phone,
      line1: input.line1,
      city: input.city,
      state: input.state,
      zip: input.zip,
      country: input.country,
      isDefault,
    };
    if (input.line2) created.line2 = input.line2;
    db.addresses.push(created);
    return created;
  });
  return ok(address, 201);
});
