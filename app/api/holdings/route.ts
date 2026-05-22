import { NextResponse } from "next/server";
import { holdingMutations, listHoldingViews } from "@/lib/investmentService";
import { holdingSchema } from "@/lib/validators";

export async function GET() {
  try {
    return NextResponse.json(await listHoldingViews());
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = holdingSchema.parse(await request.json());
    const row = await holdingMutations.create(payload);
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "持倉操作失敗";
}
