import { NextResponse } from "next/server";
import { fetchFifaResults } from "@/lib/fifa-results";
import { scorePredictions } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fifaResults = await fetchFifaResults().catch((error) => {
      console.error("[leaderboard] Falha ao buscar resultados da FIFA:", error);
      return null;
    });

    const resultsByMatchId = fifaResults?.resultsByMatchId;

    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      include: {
        predictions: {
          select: {
            matchId: true,
            homeScore: true,
            awayScore: true,
          },
        },
      },
    });

    const leaderboard = users
      .map((user) => {
        const score = resultsByMatchId
          ? scorePredictions(user.predictions, resultsByMatchId)
          : scorePredictions(user.predictions);

        return {
          userId: user.id,
          name: user.name,
          score,
          exactHits: score,
          predictionsCount: user.predictions.length,
        };
      })
      .sort((first, second) => {
        if (second.score !== first.score) {
          return second.score - first.score;
        }

        if (second.predictionsCount !== first.predictionsCount) {
          return second.predictionsCount - first.predictionsCount;
        }

        return first.name.localeCompare(second.name, "pt-BR");
      });

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("[leaderboard] Erro ao carregar ranking:", error);

    return NextResponse.json(
      { error: "Não foi possível carregar o ranking." },
      { status: 500 },
    );
  }
}
