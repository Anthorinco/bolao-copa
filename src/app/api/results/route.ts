import { writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FIFA_RESULTS_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=en&count=120&idCompetition=17&idSeason=285023&from=2026-06-11&to=2026-07-19";

type FifaTeam = {
  TeamName?: Array<{ Locale?: string; Description?: string }>;
  ShortClubName?: string;
  Score?: number | null;
};

type FifaMatch = {
  IdMatch?: string;
  LocalDate?: string;
  Home?: FifaTeam;
  Away?: FifaTeam;
  MatchStatus?: number;
};

function getTeamName(team: FifaTeam | undefined) {
  return (
    team?.TeamName?.find((name) => name.Locale === "en-GB")?.Description ??
    team?.ShortClubName ??
    ""
  );
}

function translateTeamName(teamName: string) {
  const names: Record<string, string> = {
    Algeria: "Argélia",
    Argentina: "Argentina",
    Australia: "Austrália",
    Austria: "Áustria",
    Belgium: "Bélgica",
    "Bosnia and Herzegovina": "Bósnia e Herzegovina",
    Brazil: "Brasil",
    "Cabo Verde": "Cabo Verde",
    Canada: "Canadá",
    Colombia: "Colômbia",
    "Congo DR": "RD Congo",
    "Côte d'Ivoire": "Costa do Marfim",
    Curaçao: "Curaçao",
    Czechia: "Tchéquia",
    Ecuador: "Equador",
    Egypt: "Egito",
    England: "Inglaterra",
    France: "França",
    Germany: "Alemanha",
    Ghana: "Gana",
    Haiti: "Haiti",
    "IR Iran": "Irã",
    Iraq: "Iraque",
    Japan: "Japão",
    Jordan: "Jordânia",
    "Korea Republic": "Coreia do Sul",
    Mexico: "México",
    Morocco: "Marrocos",
    Netherlands: "Países Baixos",
    "New Zealand": "Nova Zelândia",
    Norway: "Noruega",
    Panama: "Panamá",
    Paraguay: "Paraguai",
    Portugal: "Portugal",
    Qatar: "Catar",
    "Saudi Arabia": "Arábia Saudita",
    Scotland: "Escócia",
    Senegal: "Senegal",
    "South Africa": "África do Sul",
    Spain: "Espanha",
    Sweden: "Suécia",
    Switzerland: "Suíça",
    Tunisia: "Tunísia",
    Türkiye: "Turquia",
    Uruguay: "Uruguai",
    USA: "Estados Unidos",
    Uzbekistan: "Uzbequistão",
  };

  return names[teamName] ?? teamName;
}

function toResult(match: FifaMatch) {
  return {
    date: match.LocalDate?.slice(0, 10),
    team1: translateTeamName(getTeamName(match.Home)),
    team2: translateTeamName(getTeamName(match.Away)),
    score1: match.Home?.Score,
    score2: match.Away?.Score,
    fifaMatchId: match.IdMatch,
  };
}

export async function POST(request: Request) {
  const adminToken = process.env.RESULTS_UPDATE_TOKEN;
  const incomingToken = request.headers.get("x-admin-token");

  if (process.env.NODE_ENV === "production" && !adminToken) {
    return NextResponse.json(
      {
        error:
          "Atualização de resultados desativada. Configure RESULTS_UPDATE_TOKEN no servidor.",
      },
      { status: 403 },
    );
  }

  if (adminToken && incomingToken !== adminToken) {
    return NextResponse.json(
      { error: "Senha de atualização inválida." },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(FIFA_RESULTS_URL, { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Não foi possível buscar os resultados na FIFA." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as { Results?: FifaMatch[] };
    const matches = (data.Results ?? [])
      .filter(
        (match) =>
          match.MatchStatus === 0 &&
          Number.isInteger(match.Home?.Score) &&
          Number.isInteger(match.Away?.Score) &&
          typeof match.LocalDate === "string",
      )
      .map(toResult);

    const output = {
      name: "Resultados da Copa do Mundo FIFA 2026",
      source: FIFA_RESULTS_URL,
      updatedAt: new Date().toISOString(),
      rounds: [
        {
          name: "Fase de grupos",
          matches,
        },
      ],
    };

    await writeFile(
      path.join(process.cwd(), "src/data/fifa-results.json"),
      `${JSON.stringify(output, null, 2)}\n`,
    );

    return NextResponse.json({
      matchesCount: matches.length,
      updatedAt: output.updatedAt,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível atualizar os resultados oficiais." },
      { status: 500 },
    );
  }
}
