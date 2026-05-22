import { NextResponse } from "next/server";
import { recommendationMutations } from "@/lib/investmentService";
import { recommendationSchema } from "@/lib/validators";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = recommendationSchema.partial().parse(await request.json());
    const row = await recommendationMutations.update(id, payload);
    if (!row) return NextResponse.json({ error: "找不到推薦資料" }, { status: 404 });
    return NextResponse.json(row);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const deleted = await recommendationMutations.delete(id);
    if (!deleted) return NextResponse.json({ error: "找不到推薦資料" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "推薦資料操作失敗";
}
