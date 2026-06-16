import fifaResults from "@/data/fifa-results.json";

import type { MatchResult } from "@/lib/matches";

type OpenfootballTeam =
  | string
  | {
      name?: unknown;
      code?: unknown;
    };

type OpenfootballTeamObject = Exclude<OpenfootballTeam, string>;

type OpenfootballMatch = {
  id?: unknown;
  date?: unknown;
  team1?: unknown;
  team2?: unknown;
  home_team?: unknown;
  away_team?: unknown;
  score1?: unknown;
  score2?: unknown;
  score1i?: unknown;
  score2i?: unknown;
  goals1?: unknown;
  goals2?: unknown;
};

type OpenfootballRound = {
  matches?: unknown;
};

type OpenfootballData = {
  matches?: unknown;
  rounds?: unknown;
};

function normalizeText(value: string) {
  const normalizedValue = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const aliases: Record<string, string> = {
    "africa-do-sul": "south-africa",
    alemanha: "germany",
    argelia: "algeria",
    "arabia-saudita": "saudi-arabia",
    australia: "australia",
    austria: "austria",
    belgica: "belgium",
    "bosnia-and-herzegovina": "bosnia-herzegovina",
    "bosnia-e-herzegovina": "bosnia-herzegovina",
    brasil: "brazil",
    "cabo-verde": "cape-verde",
    canada: "canada",
    catar: "qatar",
    "colombia": "colombia",
    "congo-dr": "dr-congo",
    "coreia-do-sul": "south-korea",
    "costa-do-marfim": "ivory-coast",
    "cote-d-ivoire": "ivory-coast",
    croacia: "croatia",
    czechia: "czech-republic",
    egito: "egypt",
    equador: "ecuador",
    escocia: "scotland",
    espanha: "spain",
    "estados-unidos": "usa",
    franca: "france",
    inglaterra: "england",
    "ir-iran": "iran",
    ira: "iran",
    iraque: "iraq",
    japao: "japan",
    jordania: "jordan",
    "korea-republic": "south-korea",
    marrocos: "morocco",
    mexico: "mexico",
    "nova-zelandia": "new-zealand",
    noruega: "norway",
    "paises-baixos": "netherlands",
    panama: "panama",
    paraguai: "paraguay",
    "rd-congo": "dr-congo",
    suica: "switzerland",
    suecia: "sweden",
    tchequia: "czech-republic",
    tunisia: "tunisia",
    turquia: "turkey",
    turkiye: "turkey",
    uruguai: "uruguay",
    uzbequistao: "uzbekistan",
  };

  return aliases[normalizedValue] ?? normalizedValue;
}

function getTeamName(team: unknown) {
  if (typeof team === "string") {
    return team.trim();
  }

  if (team && typeof team === "object") {
    const candidate = (team as OpenfootballTeamObject).name;

    if (typeof candidate === "string") {
      return candidate.trim();
    }
  }

  return "";
}

function getScore(primary: unknown, fallback: unknown) {
  if (typeof primary === "number" && Number.isInteger(primary)) {
    return primary;
  }

  if (typeof fallback === "number" && Number.isInteger(fallback)) {
    return fallback;
  }

  return null;
}

function getMatches(data: OpenfootballData) {
  if (Array.isArray(data.matches)) {
    return data.matches as OpenfootballMatch[];
  }

  if (!Array.isArray(data.rounds)) {
    return [];
  }

  return (data.rounds as OpenfootballRound[]).flatMap((round) =>
    Array.isArray(round.matches) ? (round.matches as OpenfootballMatch[]) : [],
  );
}

function getMatchId(match: OpenfootballMatch) {
  if (typeof match.id === "string" && match.id.trim()) {
    return match.id.trim();
  }

  const date = typeof match.date === "string" ? match.date.slice(0, 10) : "";
  const homeTeam = getTeamName(match.team1 ?? match.home_team);
  const awayTeam = getTeamName(match.team2 ?? match.away_team);

  if (!date || !homeTeam || !awayTeam) {
    return "";
  }

  return `${date}-${normalizeText(homeTeam)}-${normalizeText(awayTeam)}`;
}

export function parseResultsData(data: unknown) {
  const results = new Map<string, MatchResult>();

  if (!data || typeof data !== "object") {
    return results;
  }

  for (const match of getMatches(data as OpenfootballData)) {
    const matchId = getMatchId(match);
    const homeScore = getScore(match.score1, match.goals1);
    const awayScore = getScore(match.score2, match.goals2);

    if (!matchId || homeScore === null || awayScore === null) {
      continue;
    }

    results.set(matchId, { homeScore, awayScore });
  }

  return results;
}

export const resultsByMatchId = parseResultsData(fifaResults);
