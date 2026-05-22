import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/priceProvider";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") || "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "請提供 symbols，例如 /api/prices?symbols=2330,3661" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getQuotes(symbols));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "報價查詢失敗" }, { status: 500 });
  }
}
