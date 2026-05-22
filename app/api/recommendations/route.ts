import { NextResponse } from "next/server";
import { listRecommendationViews, recommendationMutations } from "@/lib/investmentService";
import { recommendationSchema } from "@/lib/validators";

export async function GET() {
  try {
    return NextResponse.json(await listRecommendationViews());
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = recommendationSchema.parse(await request.json());
    const row = await recommendationMutations.create(payload);
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "推薦資料操作失敗";
}
