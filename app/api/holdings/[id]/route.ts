import { NextResponse } from "next/server";
import { holdingMutations } from "@/lib/investmentService";
import { holdingSchema } from "@/lib/validators";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = holdingSchema.partial().parse(await request.json());
    const row = await holdingMutations.update(id, payload);
    if (!row) return NextResponse.json({ error: "找不到持倉" }, { status: 404 });
    return NextResponse.json(row);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const deleted = await holdingMutations.delete(id);
    if (!deleted) return NextResponse.json({ error: "找不到持倉" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "持倉操作失敗";
}
