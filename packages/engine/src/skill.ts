// Skill rating. The formula is fixed in code by decision (requirements: "Skill").
// Skill = 5(W + L + D) + 2*Smokers + MT months + (All training months - MT months)/2 + Intangibles

export interface SkillInputs {
  wins: number;
  losses: number;
  draws: number;
  smokers: number;
  mtMonths: number;
  allTrainingMonths: number;
  intangibles: number;
}

export function computeSkill(i: SkillInputs): number {
  const fights = i.wins + i.losses + i.draws;
  const raw = fights * 5 + i.smokers * 2 + i.mtMonths + (i.allTrainingMonths - i.mtMonths) / 2 + i.intangibles;
  return Math.round(raw * 10) / 10;
}

/** Whole calendar months from `from` to `to` (never negative). */
export function monthsBetween(from: Date, to: Date): number {
  let m = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

export interface RecordedTraining {
  mtMonths: number;
  allTrainingMonths: number;
  /** Date the month counts were recorded; null means "don't accrue". */
  asOf: Date | null;
  stillTraining: boolean;
}

/** Training months as of a date: recorded months plus months since, while still training. */
export function trainingMonthsAt(t: RecordedTraining, on: Date): { mtMonths: number; allTrainingMonths: number } {
  const elapsed = t.stillTraining && t.asOf ? monthsBetween(t.asOf, on) : 0;
  return {
    mtMonths: t.mtMonths > 0 ? t.mtMonths + elapsed : 0,
    allTrainingMonths: t.allTrainingMonths > 0 ? t.allTrainingMonths + elapsed : 0,
  };
}
