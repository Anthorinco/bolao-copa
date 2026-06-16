import type { MatchResult } from "@/lib/matches";
import { parseResultsData } from "@/lib/results";

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

export async function fetchFifaResults() {
  const response = await fetch(FIFA_RESULTS_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Não foi possível buscar os resultados na FIFA.");
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

  const resultsByMatchId = parseResultsData({
    rounds: [{ name: "Fase de grupos", matches }],
  });

  const results = Object.fromEntries(
    [...resultsByMatchId.entries()].map(([matchId, result]) => [
      matchId,
      result,
    ]),
  ) as Record<string, MatchResult>;

  return {
    matches,
    results,
    resultsByMatchId,
    updatedAt: new Date().toISOString(),
  };
}
