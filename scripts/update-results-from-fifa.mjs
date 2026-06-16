import { writeFile } from "node:fs/promises";

const endpoint =
  "https://api.fifa.com/api/v3/calendar/matches?language=en&count=120&idCompetition=17&idSeason=285023&from=2026-06-11&to=2026-07-19";

function getTeamName(team) {
  return (
    team?.TeamName?.find((name) => name.Locale === "en-GB")?.Description ??
    team?.ShortClubName ??
    ""
  );
}

function translateTeamName(teamName) {
  const names = {
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

function toResult(match) {
  return {
    date: match.LocalDate.slice(0, 10),
    team1: translateTeamName(getTeamName(match.Home)),
    team2: translateTeamName(getTeamName(match.Away)),
    score1: match.Home.Score,
    score2: match.Away.Score,
    fifaMatchId: match.IdMatch,
  };
}

const response = await fetch(endpoint);

if (!response.ok) {
  throw new Error(
    `FIFA API returned ${response.status} ${response.statusText}`,
  );
}

const data = await response.json();
const matches = data.Results.filter(
  (match) =>
    match.MatchStatus === 0 &&
    Number.isInteger(match.Home?.Score) &&
    Number.isInteger(match.Away?.Score) &&
    typeof match.LocalDate === "string",
).map(toResult);

const output = {
  name: "Resultados da Copa do Mundo FIFA 2026",
  source: endpoint,
  updatedAt: new Date().toISOString(),
  rounds: [
    {
      name: "Fase de grupos",
      matches,
    },
  ],
};

await writeFile(
  new URL("../src/data/fifa-results.json", import.meta.url),
  `${JSON.stringify(output, null, 2)}\n`,
);

console.log(`Atualizados ${matches.length} jogos finalizados pela FIFA.`);
