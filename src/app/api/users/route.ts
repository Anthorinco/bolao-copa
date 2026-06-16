import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { MAX_PARTICIPANTS } from "@/lib/participants";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar os participantes." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "Digite um nome para adicionar o participante." },
      { status: 400 },
    );
  }

  if (name.length > 80) {
    return NextResponse.json(
      { error: "Use um nome com até 80 caracteres." },
      { status: 400 },
    );
  }

  try {
    const usersCount = await prisma.user.count();

    if (usersCount >= MAX_PARTICIPANTS) {
      return NextResponse.json(
        {
          error: `O bolão aceita no máximo ${MAX_PARTICIPANTS} participantes.`,
        },
        { status: 409 },
      );
    }

    const user = await prisma.user.create({
      data: { name },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Já existe um participante com esse nome." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Não foi possível adicionar o participante." },
      { status: 500 },
    );
  }
}
