import { NextResponse } from "next/server";
import { scorePredictions } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
        const score = scorePredictions(user.predictions);

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
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar o ranking." },
      { status: 500 },
    );
  }
}
