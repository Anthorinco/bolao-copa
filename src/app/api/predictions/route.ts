import { NextResponse } from "next/server";
import { matchIds } from "@/lib/matches";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type IncomingPrediction = {
  matchId?: unknown;
  homeScore?: unknown;
  awayScore?: unknown;
};

function isValidScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 30
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();

  if (!userId) {
    return NextResponse.json(
      { error: "Selecione um participante para carregar os palpites." },
      { status: 400 },
    );
  }

  try {
    const predictions = await prisma.prediction.findMany({
      where: { userId },
      orderBy: { matchId: "asc" },
      select: {
        id: true,
        userId: true,
        matchId: true,
        homeScore: true,
        awayScore: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ predictions });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar os palpites." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    userId?: unknown;
    predictions?: unknown;
  } | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";

  if (!userId) {
    return NextResponse.json(
      { error: "Selecione um participante antes de salvar." },
      { status: 400 },
    );
  }

  if (!Array.isArray(body?.predictions)) {
    return NextResponse.json(
      { error: "Envie uma lista de palpites válida." },
      { status: 400 },
    );
  }

  const seenMatchIds = new Set<string>();
  const predictions: Array<{
    matchId: string;
    homeScore: number;
    awayScore: number;
  }> = [];

  for (const rawPrediction of body.predictions as IncomingPrediction[]) {
    const matchId =
      typeof rawPrediction.matchId === "string"
        ? rawPrediction.matchId.trim()
        : "";

    if (!matchId || !matchIds.has(matchId)) {
      return NextResponse.json(
        { error: "Um dos jogos enviados não existe no calendário." },
        { status: 400 },
      );
    }

    if (seenMatchIds.has(matchId)) {
      return NextResponse.json(
        { error: "Há palpites duplicados para o mesmo jogo." },
        { status: 400 },
      );
    }

    if (
      !isValidScore(rawPrediction.homeScore) ||
      !isValidScore(rawPrediction.awayScore)
    ) {
      return NextResponse.json(
        { error: "Os placares precisam ser inteiros entre 0 e 30." },
        { status: 400 },
      );
    }

    seenMatchIds.add(matchId);
    predictions.push({
      matchId,
      homeScore: rawPrediction.homeScore,
      awayScore: rawPrediction.awayScore,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Participante não encontrado." },
        { status: 404 },
      );
    }

    const savedPredictions = await prisma.$transaction(async (tx) => {
      await tx.prediction.deleteMany({
        where: { userId },
      });

      if (predictions.length > 0) {
        await tx.prediction.createMany({
          data: predictions.map((prediction) => ({
            userId,
            matchId: prediction.matchId,
            homeScore: prediction.homeScore,
            awayScore: prediction.awayScore,
          })),
        });
      }

      return tx.prediction.findMany({
        where: { userId },
        orderBy: { matchId: "asc" },
        select: {
          id: true,
          userId: true,
          matchId: true,
          homeScore: true,
          awayScore: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return NextResponse.json({ predictions: savedPredictions });
  } catch (error) {
  console.error("[predictions] Erro ao salvar palpites:", error);

  return NextResponse.json(
    { error: "Não foi possível salvar os palpites." },
    { status: 500 },
  );
}
}
