import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { addressPatchSchema } from "@/lib/address";
import { mutate, read } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = requireUser();
  const address = read().addresses.find((a) => a.id === params.id && a.userId === user.id);
  if (!address) throw new ApiError(404, "not_found", "Address not found.");
  return ok(address);
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const user = requireUser();
  const input = await parseBody(req, addressPatchSchema);
  const address = await mutate((db) => {
    const target = db.addresses.find((a) => a.id === params.id && a.userId === user.id);
    if (!target) throw new ApiError(404, "not_found", "Address not found.");
    const { isDefault, line2, ...rest } = input;
    Object.assign(target, rest);
    if (line2 !== undefined) {
      if (line2) target.line2 = line2;
      else delete target.line2;
    }
    if (isDefault) {
      db.addresses.filter((a) => a.userId === user.id).forEach((a) => (a.isDefault = a.id === target.id));
    }
    return target;
  });
  return ok(address);
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = requireUser();
  await mutate((db) => {
    const target = db.addresses.find((a) => a.id === params.id && a.userId === user.id);
    if (!target) throw new ApiError(404, "not_found", "Address not found.");
    db.addresses = db.addresses.filter((a) => a !== target);
    if (target.isDefault) {
      const next = db.addresses.find((a) => a.userId === user.id);
      if (next) next.isDefault = true;
    }
  });
  return ok({ deleted: true });
});
