import { isCalendarDate, parisDate, shiftCalendarDate } from "./calendar";

export const WEEKLY_RULES_VERSION = "weekly-ritual-v1" as const;

export const COSMETICS = [
  { id: "classic", name: "Braise classique", description: "Le charbon et l’orange d’origine." },
  { id: "copper", name: "Cuivre ardent", description: "Des reflets cuivrés autour de votre partie." },
  { id: "aurora", name: "Aurore violette", description: "Une lueur violette douce, sans changer les scores." },
  { id: "solar", name: "Cendre solaire", description: "Un halo clair pour les longues séries." },
] as const;

export type CosmeticId = typeof COSMETICS[number]["id"];

export const WEEKLY_OBJECTIVES = [
  { id: "explore-15", name: "Attiser", description: "Proposez 15 mots", target: 15, kind: "accepted-guesses", reward: "copper" },
  { id: "return-3", name: "Revenir", description: "Jouez pendant 3 jours distincts", target: 3, kind: "active-days", reward: "aurora" },
  { id: "clear-2", name: "Viser juste", description: "Trouvez 2 mots sans indice", target: 2, kind: "hintless-wins", reward: "solar" },
] as const;

export type WeeklyObjective = typeof WEEKLY_OBJECTIVES[number];

export type ProgressFact = {
  id: string;
  type: string;
  occurredAt: string;
  value?: unknown;
  rewardId?: unknown;
};

export type ProgressWin = { id: string; hints: number; completedAt?: string };

export type WeeklyObjectiveProgress = WeeklyObjective & {
  value: number;
  complete: boolean;
  rewardId: string;
};

export type WeeklyProjection = {
  rulesVersion: typeof WEEKLY_RULES_VERSION;
  weekId: string;
  weekEnd: string;
  objectives: readonly WeeklyObjectiveProgress[];
  earnedRewardIds: readonly string[];
  unlockedCosmetics: readonly CosmeticId[];
  selectedCosmetic: CosmeticId;
};

const COSMETIC_IDS = new Set<string>(COSMETICS.map(cosmetic => cosmetic.id));

export function weekStartParis(now = new Date()) {
  const date = parisDate(now);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftCalendarDate(date, -((weekday + 6) % 7))!;
}

export function weeklyRewardCosmetic(rewardId: unknown): CosmeticId | null {
  if (typeof rewardId !== "string") return null;
  const prefix = `${WEEKLY_RULES_VERSION}:`;
  for (const objective of WEEKLY_OBJECTIVES) {
    const suffix = `:${objective.id}`;
    if (!rewardId.startsWith(prefix) || !rewardId.endsWith(suffix)) continue;
    const weekId = rewardId.slice(prefix.length, -suffix.length);
    if (isCalendarDate(weekId) && weekStartParis(new Date(`${weekId}T12:00:00Z`)) === weekId) return objective.reward;
  }
  return null;
}

function validInstant(value: string, now: Date) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

type WeekFacts = {
  guessIds: Set<string>;
  activeDays: Set<string>;
  hintlessWinIds: Set<string>;
};

function emptyWeekFacts(): WeekFacts {
  return { guessIds: new Set(), activeDays: new Set(), hintlessWinIds: new Set() };
}

function projectWeek(weekId: string, facts: WeekFacts = emptyWeekFacts()) {
  return WEEKLY_OBJECTIVES.map(objective => {
    const raw = objective.kind === "accepted-guesses"
      ? facts.guessIds.size
      : objective.kind === "active-days"
        ? facts.activeDays.size
        : facts.hintlessWinIds.size;
    const value = Math.min(objective.target, raw);
    return {
      ...objective,
      value,
      complete: raw >= objective.target,
      rewardId: `${WEEKLY_RULES_VERSION}:${weekId}:${objective.id}`,
    };
  });
}

function groupProgress(facts: readonly ProgressFact[], wins: readonly ProgressWin[], now: Date) {
  const weeks = new Map<string, WeekFacts>();
  const cosmeticSelections = new Map<CosmeticId, { id: string; occurredAt: string }>();
  const durableRewards = new Map<string, CosmeticId>();
  const dateCache = new Map<string, string>();
  const weekCache = new Map<string, string>();
  const locate = (instant: string) => {
    if (!validInstant(instant, now)) return null;
    let date = dateCache.get(instant);
    if (!date) { date = parisDate(new Date(instant)); dateCache.set(instant, date); }
    let week = weekCache.get(date);
    if (!week) { week = weekStartParis(new Date(`${date}T12:00:00Z`)); weekCache.set(date, week); }
    return { date, week };
  };
  const forWeek = (week: string) => {
    let grouped = weeks.get(week);
    if (!grouped) { grouped = emptyWeekFacts(); weeks.set(week, grouped); }
    return grouped;
  };

  for (const fact of facts) {
    const located = locate(fact.occurredAt);
    if (!located) continue;
    if (fact.type === "guessAccepted") {
      const grouped = forWeek(located.week);
      grouped.guessIds.add(fact.id);
      grouped.activeDays.add(located.date);
    } else if (fact.type === "cosmeticChanged" && typeof fact.value === "string" && COSMETIC_IDS.has(fact.value)) {
      const id = fact.value as CosmeticId;
      const current = cosmeticSelections.get(id);
      const candidate = `${fact.occurredAt}:${fact.id}`;
      if (!current || candidate > `${current.occurredAt}:${current.id}`) cosmeticSelections.set(id, { id: fact.id, occurredAt: fact.occurredAt });
    } else if (fact.type === "weeklyRewardEarned") {
      const cosmetic = weeklyRewardCosmetic(fact.rewardId);
      if (cosmetic && fact.value === cosmetic) durableRewards.set(fact.rewardId as string, cosmetic);
    }
  }
  for (const win of wins) {
    if (!win.completedAt || win.hints !== 0) continue;
    const located = locate(win.completedAt);
    if (located) forWeek(located.week).hintlessWinIds.add(win.id);
  }
  return { weeks, cosmeticSelections, durableRewards };
}

function selectedCosmetic(selections: ReadonlyMap<CosmeticId, { id: string; occurredAt: string }>, unlocked: ReadonlySet<CosmeticId>): CosmeticId {
  let selected: CosmeticId = "classic";
  let stamp = "";
  for (const [cosmetic, fact] of selections) {
    if (!unlocked.has(cosmetic)) continue;
    const candidate = `${fact.occurredAt}:${fact.id}`;
    if (candidate > stamp) { stamp = candidate; selected = cosmetic; }
  }
  return selected;
}

export function projectWeeklyRitual(facts: readonly ProgressFact[], wins: readonly ProgressWin[], now = new Date()): WeeklyProjection {
  const weekId = weekStartParis(now);
  const grouped = groupProgress(facts, wins, now);
  const rewards = new Map(grouped.durableRewards);
  for (const [pastWeekId, progress] of grouped.weeks) {
    for (const objective of projectWeek(pastWeekId, progress)) {
      if (objective.complete) rewards.set(objective.rewardId, objective.reward);
    }
  }
  const unlocked = new Set<CosmeticId>(["classic", ...rewards.values()]);
  return {
    rulesVersion: WEEKLY_RULES_VERSION,
    weekId,
    weekEnd: shiftCalendarDate(weekId, 6)!,
    objectives: projectWeek(weekId, grouped.weeks.get(weekId)),
    earnedRewardIds: [...rewards.keys()].sort(),
    unlockedCosmetics: COSMETICS.map(cosmetic => cosmetic.id).filter(id => unlocked.has(id)),
    selectedCosmetic: selectedCosmetic(grouped.cosmeticSelections, unlocked),
  };
}

export function isCosmeticId(value: unknown): value is CosmeticId {
  return typeof value === "string" && COSMETIC_IDS.has(value);
}
