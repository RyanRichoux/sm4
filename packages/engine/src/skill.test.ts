import { describe, expect, it } from "vitest";
import { computeSkill, monthsBetween, trainingMonthsAt } from "./index.js";

const base = { wins: 0, losses: 0, draws: 0, smokers: 0, mtMonths: 0, allTrainingMonths: 0, intangibles: 0 };

describe("computeSkill", () => {
  it("matches the spreadsheet formula", () => {
    // 2 fights*5 + 3 smokers*2 + 12 MT + (20-12)/2 + 4 intangibles = 10 + 6 + 12 + 4 + 4
    expect(computeSkill({ ...base, wins: 1, losses: 1, smokers: 3, mtMonths: 12, allTrainingMonths: 20, intangibles: 4 })).toBe(36);
  });
  it("each smoker adds 2 and each fight adds 5", () => {
    expect(computeSkill({ ...base, smokers: 1 }) - computeSkill(base)).toBe(2);
    expect(computeSkill({ ...base, draws: 1 }) - computeSkill(base)).toBe(5);
  });
  it("allows negative intangibles", () => {
    expect(computeSkill({ ...base, mtMonths: 6, allTrainingMonths: 6, intangibles: -2 })).toBe(4);
  });
});

describe("training months", () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  it("counts whole months", () => {
    expect(monthsBetween(d("2026-01-15"), d("2026-03-14"))).toBe(1);
    expect(monthsBetween(d("2026-01-15"), d("2026-03-15"))).toBe(2);
    expect(monthsBetween(d("2026-03-15"), d("2026-01-15"))).toBe(0);
  });
  it("accrues only while still training, and only for recorded kinds", () => {
    const rec = { mtMonths: 10, allTrainingMonths: 0, asOf: d("2026-01-01"), stillTraining: true };
    expect(trainingMonthsAt(rec, d("2026-07-01"))).toEqual({ mtMonths: 16, allTrainingMonths: 0 });
    expect(trainingMonthsAt({ ...rec, stillTraining: false }, d("2026-07-01")).mtMonths).toBe(10);
  });
});
