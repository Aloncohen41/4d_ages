/** Helpers for jumping around the story by date. Only dates that actually have something in them are ever offered. */
export interface Period {
  year: number;
  month?: number; // 1–12
  day?: number;
}
export interface DayCount { day: number; count: number }
export interface MonthCount { month: number; count: number; days: DayCount[] }
export interface YearCount { year: number; count: number; months: MonthCount[] }

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const parts = (iso: string) => ({ y: +iso.slice(0, 4), m: +iso.slice(5, 7), d: +iso.slice(8, 10) });

/** Years → months → days that contain something, newest first at every level. */
export function dateIndex(items: { date: string }[]): YearCount[] {
  const years = new Map<number, Map<number, Map<number, number>>>();
  for (const it of items) {
    const { y, m, d } = parts(it.date);
    if (!y || !m || !d) continue;
    const ym = years.get(y) ?? years.set(y, new Map()).get(y)!;
    const md = ym.get(m) ?? ym.set(m, new Map()).get(m)!;
    md.set(d, (md.get(d) || 0) + 1);
  }
  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, ms]) => {
      const months = [...ms.entries()].sort((a, b) => b[0] - a[0]).map(([month, ds]) => {
        const days = [...ds.entries()].sort((a, b) => b[0] - a[0]).map(([day, count]) => ({ day, count }));
        return { month, count: days.reduce((n, d) => n + d.count, 0), days };
      });
      return { year, count: months.reduce((n, m) => n + m.count, 0), months };
    });
}

export function inPeriod(date: string, p: Period): boolean {
  const { y, m, d } = parts(date);
  return y === p.year && (p.month === undefined || m === p.month) && (p.day === undefined || d === p.day);
}

export function periodLabel(p: Period): string {
  if (p.month === undefined) return String(p.year);
  const month = `${MONTH_NAMES[p.month - 1]} ${p.year}`;
  return p.day === undefined ? month : `${p.day} ${month}`;
}
