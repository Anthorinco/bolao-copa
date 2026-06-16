import { NextResponse } from "next/server";
import { fetchFifaResults } from "@/lib/fifa-results";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const data = await fetchFifaResults();

    return NextResponse.json({
      matchesCount: Object.keys(data.results).length,
      results: data.results,
      updatedAt: data.updatedAt,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível atualizar os resultados oficiais." },
      { status: 500 },
    );
  }
}
