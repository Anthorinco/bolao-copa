"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { matchesByGroup } from "@/lib/matches";
import type { GroupKey } from "@/lib/matches";
import { MAX_PARTICIPANTS } from "@/lib/participants";

const totalMatches = matchesByGroup.reduce(
  (total, group) => total + group.matches.length,
  0,
);

type User = {
  id: string;
  name: string;
  createdAt: string;
};

type Prediction = {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  createdAt: string;
  updatedAt: string;
};

type LeaderboardEntry = {
  userId: string;
  name: string;
  score: number;
  exactHits: number;
  predictionsCount: number;
};

type DraftScore = {
  homeScore: string;
  awayScore: string;
};

type DraftScores = Record<string, DraftScore>;

type MatchResult = {
  homeScore: number;
  awayScore: number;
};

type OfficialResults = Record<string, MatchResult>;

type SavePayloadPrediction = {
  matchId: string;
  homeScore: number;
  awayScore: number;
};

type GroupFilter = GroupKey | "all";

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    let message = "Algo deu errado. Tente novamente.";

    try {
      const data = (await response.json()) as { error?: string };
      message = data.error ?? message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

function createEmptyDraft() {
  const draft: DraftScores = {};

  for (const group of matchesByGroup) {
    for (const match of group.matches) {
      draft[match.id] = { homeScore: "", awayScore: "" };
    }
  }

  return draft;
}

function applyPredictionsToDraft(predictions: Prediction[]) {
  const draft = createEmptyDraft();

  for (const prediction of predictions) {
    draft[prediction.matchId] = {
      homeScore: String(prediction.homeScore),
      awayScore: String(prediction.awayScore),
    };
  }

  return draft;
}

function validateDraft(draft: DraftScores) {
  const predictions: SavePayloadPrediction[] = [];

  for (const group of matchesByGroup) {
    for (const match of group.matches) {
      const current = draft[match.id] ?? { homeScore: "", awayScore: "" };
      const homeScore = current.homeScore.trim();
      const awayScore = current.awayScore.trim();

      if (!homeScore && !awayScore) {
        continue;
      }

      if (!homeScore || !awayScore) {
        throw new Error(
          `Complete os dois placares ou limpe os dois campos em ${match.homeTeam} x ${match.awayTeam}.`,
        );
      }

      const parsedHomeScore = Number(homeScore);
      const parsedAwayScore = Number(awayScore);
      const validHomeScore =
        Number.isInteger(parsedHomeScore) &&
        parsedHomeScore >= 0 &&
        parsedHomeScore <= 30;
      const validAwayScore =
        Number.isInteger(parsedAwayScore) &&
        parsedAwayScore >= 0 &&
        parsedAwayScore <= 30;

      if (!validHomeScore || !validAwayScore) {
        throw new Error(
          `Use placares inteiros entre 0 e 30 em ${match.homeTeam} x ${match.awayTeam}.`,
        );
      }

      predictions.push({
        matchId: match.id,
        homeScore: parsedHomeScore,
        awayScore: parsedAwayScore,
      });
    }
  }

  return predictions;
}

function buildUserUrl(userId: string) {
  return `/?userId=${encodeURIComponent(userId)}`;
}

function createInitialOfficialResults() {
  const results: OfficialResults = {};

  for (const group of matchesByGroup) {
    for (const match of group.matches) {
      if (match.result) {
        results[match.id] = match.result;
      }
    }
  }

  return results;
}

export function BolaoApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlUserId = searchParams.get("userId") ?? "";
  const [users, setUsers] = useState<User[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [newUserName, setNewUserName] = useState("");
  const [draft, setDraft] = useState<DraftScores>(() => createEmptyDraft());
  const [isBooting, setIsBooting] = useState(true);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingResults, setIsUpdatingResults] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupFilter>("A");
  const [officialResults, setOfficialResults] = useState<OfficialResults>(() =>
    createInitialOfficialResults(),
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedUserId = useMemo(() => {
    if (users.length === 0) {
      return "";
    }

    return users.some((user) => user.id === urlUserId) ? urlUserId : users[0].id;
  }, [urlUserId, users]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId),
    [selectedUserId, users],
  );

  const completedPredictionsCount = useMemo(
    () =>
      Object.values(draft).filter(
        (score) => score.homeScore.trim() && score.awayScore.trim(),
      ).length,
    [draft],
  );

  const hasReachedParticipantsLimit = users.length >= MAX_PARTICIPANTS;
  const completedResultsCount = Object.keys(officialResults).length;

  const displayedGroups = useMemo(
    () =>
      selectedGroup === "all"
        ? matchesByGroup
        : matchesByGroup.filter((group) => group.group === selectedGroup),
    [selectedGroup],
  );

  const groupProgress = useMemo(() => {
    const progress = new Map<GroupFilter, number>();
    let allCompleted = 0;

    for (const group of matchesByGroup) {
      const completed = group.matches.filter((match) => {
        const score = draft[match.id];
        return score?.homeScore.trim() && score.awayScore.trim();
      }).length;

      allCompleted += completed;
      progress.set(group.group, completed);
    }

    progress.set("all", allCompleted);
    return progress;
  }, [draft]);

  const refreshUsers = useCallback(async () => {
    const data = await fetchJson<{ users: User[] }>("/api/users");
    setUsers(data.users);
    return data.users;
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    const data = await fetchJson<{ leaderboard: LeaderboardEntry[] }>(
      "/api/leaderboard",
    );
    setLeaderboard(data.leaderboard);
  }, []);

  const refreshOfficialResults = useCallback(async () => {
    const data = await fetchJson<{
      matchesCount: number;
      results: OfficialResults;
    }>("/api/results", { method: "POST" });
    setOfficialResults(data.results);
    return data.matchesCount;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      try {
        setError("");
        await Promise.all([
          refreshUsers(),
          refreshLeaderboard(),
          refreshOfficialResults(),
        ]);
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível carregar o bolão.",
          );
        }
      } finally {
        if (isMounted) {
          setIsBooting(false);
        }
      }
    }

    void boot();

    return () => {
      isMounted = false;
    };
  }, [refreshLeaderboard, refreshOfficialResults, refreshUsers]);

  useEffect(() => {
    if (users.length === 0) {
      if (urlUserId) {
        router.replace("/", { scroll: false });
      }

      return;
    }

    const userExists = users.some((user) => user.id === urlUserId);

    if (!userExists) {
      router.replace(buildUserUrl(users[0].id), { scroll: false });
    }
  }, [router, urlUserId, users]);

  useEffect(() => {
    if (!selectedUserId) {
      return;
    }

    let isMounted = true;

    async function loadPredictions() {
      try {
        setIsLoadingPredictions(true);
        setError("");
        const data = await fetchJson<{ predictions: Prediction[] }>(
          `/api/predictions?userId=${encodeURIComponent(selectedUserId)}`,
        );

        if (isMounted) {
          setDraft(applyPredictionsToDraft(data.predictions));
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível carregar os palpites.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingPredictions(false);
        }
      }
    }

    void loadPredictions();

    return () => {
      isMounted = false;
    };
  }, [selectedUserId]);

  async function handleAddUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newUserName.trim();

    if (!name) {
      setError("Digite um nome para adicionar o participante.");
      setNotice("");
      return;
    }

    try {
      setIsAddingUser(true);
      setError("");
      setNotice("");
      const data = await fetchJson<{ user: User }>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const nextUsers = await refreshUsers();

      setNewUserName("");
      setNotice(`${data.user.name} entrou no bolão.`);
      router.push(buildUserUrl(data.user.id), { scroll: false });

      if (nextUsers.length === 1) {
        await refreshLeaderboard();
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível adicionar o participante.",
      );
    } finally {
      setIsAddingUser(false);
    }
  }

  async function handleSavePredictions() {
    if (!selectedUserId) {
      setError("Selecione um participante antes de salvar.");
      setNotice("");
      return;
    }

    let predictions: SavePayloadPrediction[] = [];

    try {
      predictions = validateDraft(draft);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Revise os placares antes de salvar.",
      );
      setNotice("");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setNotice("");
      const data = await fetchJson<{ predictions: Prediction[] }>(
        "/api/predictions",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedUserId, predictions }),
        },
      );

      setDraft(applyPredictionsToDraft(data.predictions));
      setNotice("Palpites salvos com sucesso.");
      await refreshLeaderboard();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível salvar os palpites.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateResults() {
    try {
      setIsUpdatingResults(true);
      setError("");
      setNotice("");
      const matchesCount = await refreshOfficialResults();
      await refreshLeaderboard();

      setNotice(
        `${matchesCount} resultados oficiais foram atualizados.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar os resultados oficiais.",
      );
    } finally {
      setIsUpdatingResults(false);
    }
  }

  function handleSelectedUserChange(userId: string) {
    setNotice("");
    setError("");

    if (userId) {
      router.push(buildUserUrl(userId), { scroll: false });
    }
  }

  function handleScoreChange(
    matchId: string,
    side: keyof DraftScore,
    value: string,
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [matchId]: {
        ...currentDraft[matchId],
        [side]: value,
      },
    }));
  }

  return (
    <main className="app-shell mx-auto min-h-screen w-full max-w-7xl px-3 pb-28 pt-4 sm:px-6 sm:py-6 lg:px-8">
      <section className="panel mb-6 flex flex-col gap-5 rounded-lg p-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">
            Copa do Mundo 2026
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black text-white sm:text-4xl">
                Bolão da fase de grupos
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Escolha o participante, preencha os placares e salve. O ranking
                é atualizado com os resultados oficiais da FIFA.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[380px]">
              <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-200">
                {completedPredictionsCount} de {totalMatches} palpites
              </div>
              <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-200">
                {completedResultsCount} resultados oficiais
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)_auto]">
          <form
            onSubmit={handleAddUser}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <label className="flex-1">
              <span className="label mb-1 block">
                Adicionar participante ({users.length}/{MAX_PARTICIPANTS})
              </span>
              <input
                value={newUserName}
                onChange={(event) => setNewUserName(event.target.value)}
                maxLength={80}
                placeholder="Nome do participante"
                disabled={hasReachedParticipantsLimit}
                className="field px-3"
              />
            </label>
            <button
              type="submit"
              disabled={isAddingUser || hasReachedParticipantsLimit}
              className="primary-button h-11 self-end px-5"
            >
              {hasReachedParticipantsLimit
                ? "Limite atingido"
                : isAddingUser
                  ? "Adicionando..."
                  : "Adicionar"}
            </button>
          </form>

          <label>
            <span className="label mb-1 block">
              Participante ativo
            </span>
            <select
              value={selectedUserId}
              onChange={(event) => handleSelectedUserChange(event.target.value)}
              disabled={users.length === 0}
              className="field px-3"
            >
              {users.length === 0 ? (
                <option value="">Nenhum participante cadastrado</option>
              ) : null}
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col justify-end gap-2">
            <button
              type="button"
              onClick={handleUpdateResults}
              disabled={isUpdatingResults}
              className="secondary-button h-11 px-5"
            >
              {isUpdatingResults
                ? "Buscando resultados..."
                : "Buscar resultados oficiais"}
            </button>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="label">Mostrar jogos</span>
            <span className="text-xs font-bold text-slate-500">
              Toque em um grupo
            </span>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {[{ group: "all" as const, label: "Todos" }, ...matchesByGroup.map((group) => ({
              group: group.group,
              label: group.group,
            }))].map((item) => {
              const isSelected = selectedGroup === item.group;
              const total =
                item.group === "all"
                  ? totalMatches
                  : matchesByGroup.find((group) => group.group === item.group)
                      ?.matches.length ?? 0;
              const completed = groupProgress.get(item.group) ?? 0;

              return (
                <button
                  key={item.group}
                  type="button"
                  onClick={() => setSelectedGroup(item.group)}
                  className={`min-w-16 rounded-md border px-3 py-2 text-sm font-black ${
                    isSelected
                      ? "border-emerald-300/60 bg-emerald-300/16 text-emerald-100"
                      : "border-white/10 bg-white/[0.04] text-slate-300"
                  }`}
                >
                  <span className="block">{item.label}</span>
                  <span className="mt-0.5 block text-[0.68rem] font-bold text-slate-500">
                    {completed}/{total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="status-error rounded-md px-4 py-3 text-sm font-bold">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="status-success rounded-md px-4 py-3 text-sm font-bold">
            {notice}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-4">
          <div className="panel-solid flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">
                Palpites{selectedUser ? ` de ${selectedUser.name}` : ""}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Campos vazios ficam sem palpite salvo. Para remover um palpite,
                limpe os dois placares e salve.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSavePredictions}
              disabled={!selectedUserId || isSaving || isLoadingPredictions}
              className="secondary-button h-11 px-5"
            >
              {isSaving ? "Salvando..." : "Salvar palpites"}
            </button>
          </div>

          {isBooting ? (
            <div className="panel-solid rounded-lg p-6 text-slate-300">
              Carregando participantes e ranking...
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-lg border border-dashed border-emerald-300/28 bg-emerald-300/5 p-8 text-center">
              <h2 className="text-xl font-black text-white">
                Comece adicionando o primeiro participante.
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Depois disso o seletor passa a controlar os palpites de cada
                participante.
              </p>
            </div>
          ) : (
            displayedGroups.map((group) => (
              <section
                key={group.group}
                className="panel-solid overflow-hidden rounded-lg"
              >
                <div className="flex items-center justify-between border-b border-emerald-200/10 bg-gradient-to-r from-emerald-500/16 via-blue-500/10 to-transparent px-4 py-3 text-white">
                  <h3 className="text-lg font-bold">Grupo {group.group}</h3>
                  <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-bold text-slate-200">
                    {group.matches.length} jogos
                  </span>
                </div>

                <div className="divide-y divide-white/[0.07]">
                  {group.matches.map((match) => {
                    const currentScore = draft[match.id] ?? {
                      homeScore: "",
                      awayScore: "",
                    };

                    return (
                      <div
                        key={match.id}
                        className="grid gap-4 px-3 py-4 transition hover:bg-white/[0.04] sm:px-4 md:grid-cols-[160px_minmax(0,1fr)_170px]"
                      >
                        <div className="text-sm text-slate-400">
                          <p className="font-bold text-slate-100">
                            {match.dateLabel}
                          </p>
                          <p>{match.timeLabel}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {match.venue}
                          </p>
                        </div>

                        <div className="min-w-0">
                          {(() => {
                            const result = officialResults[match.id];

                            return (
                              <>
                          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
                            <p className="min-w-0 break-words text-center font-bold text-slate-100 md:truncate md:text-right">
                              {match.homeTeam}
                            </p>
                            <span className="text-sm font-bold text-slate-500">
                              x
                            </span>
                            <p className="min-w-0 break-words text-center font-bold text-slate-100 md:truncate md:text-left">
                              {match.awayTeam}
                            </p>
                          </div>

                          {result ? (
                            <p className="mt-2 text-center text-xs font-bold text-emerald-300">
                              Resultado: {result.homeScore} x {result.awayScore}
                            </p>
                          ) : (
                            <p className="mt-2 text-center text-xs font-medium text-slate-500">
                              Aguardando resultado
                            </p>
                          )}
                              </>
                            );
                          })()}
                        </div>

                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                          <label>
                            <span className="sr-only">
                              Placar de {match.homeTeam}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={30}
                              inputMode="numeric"
                              value={currentScore.homeScore}
                              onChange={(event) =>
                                handleScoreChange(
                                  match.id,
                                  "homeScore",
                                  event.target.value,
                                )
                              }
                              disabled={isLoadingPredictions}
                              className="field text-center text-lg font-black"
                            />
                          </label>
                          <span className="text-sm font-bold text-slate-500">
                            -
                          </span>
                          <label>
                            <span className="sr-only">
                              Placar de {match.awayTeam}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={30}
                              inputMode="numeric"
                              value={currentScore.awayScore}
                              onChange={(event) =>
                                handleScoreChange(
                                  match.id,
                                  "awayScore",
                                  event.target.value,
                                )
                              }
                              disabled={isLoadingPredictions}
                              className="field text-center text-lg font-black"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </section>

        <aside className="panel h-fit rounded-lg p-4 lg:sticky lg:top-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Ranking</h2>
              <p className="text-sm text-slate-400">1 ponto por exato</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNotice("");
                setError("");
                void refreshLeaderboard();
              }}
              className="ghost-button px-3 py-2"
            >
              Atualizar ranking
            </button>
          </div>

          {leaderboard.length === 0 ? (
            <p className="rounded-md bg-white/5 px-3 py-4 text-sm text-slate-400">
              O ranking aparece quando houver participantes.
            </p>
          ) : (
            <ol className="space-y-2">
              {leaderboard.map((entry, index) => (
                <li
                  key={entry.userId}
                  className={`rounded-md border px-3 py-3 ${
                    entry.userId === selectedUserId
                      ? "border-blue-300/50 bg-blue-400/12"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        #{index + 1}
                      </p>
                      <p className="truncate font-bold text-slate-100">
                        {entry.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-emerald-300">
                        {entry.score}
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        {entry.predictionsCount} palpites
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      {users.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-emerald-200/10 bg-[#07100c]/95 px-3 py-3 shadow-[0_-18px_40px_rgba(0,0,0,0.36)] backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">
                {selectedUser?.name ?? "Participante"}
              </p>
              <p className="text-xs font-bold text-slate-500">
                {completedPredictionsCount} de {totalMatches} palpites
              </p>
            </div>
            <button
              type="button"
              onClick={handleSavePredictions}
              disabled={!selectedUserId || isSaving || isLoadingPredictions}
              className="secondary-button h-11 px-4"
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
