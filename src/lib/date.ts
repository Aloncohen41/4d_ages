const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => toISO(new Date());
export function addDays(s: string, n: number) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export function addMonths(s: string, n: number) {
  const d = parseISO(s);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}
/** Like addMonths, but never overflows into the next month: Jan 31 + 1 month is Feb 28 (or 29), not Mar 3. */
export function addMonthsClamped(s: string, n: number) {
  const d = parseISO(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}
export const daysBetween = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

export interface Age {
  years: number;
  months: number;
  days: number;
  totalDays: number;
}

export function ageBetween(birth: string, date: string): Age {
  const B = parseISO(birth);
  const D = parseISO(date);
  let years = D.getFullYear() - B.getFullYear();
  let months = D.getMonth() - B.getMonth();
  let days = D.getDate() - B.getDate();
  if (days < 0) {
    months--;
    days += new Date(D.getFullYear(), D.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  return { years, months, days, totalDays: daysBetween(birth, date) };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Short label for a photo: "3 weeks old", "7 months old", "2y 1m old" */
export function ageShort(birth: string, date: string): string {
  const a = ageBetween(birth, date);
  if (a.totalDays <= 0) return "birth day";
  if (a.totalDays < 14) return `${plural(a.totalDays, "day")} old`;
  if (a.totalDays < 56) return `${plural(Math.floor(a.totalDays / 7), "week")} old`;
  if (a.years < 1) return `${plural(a.months, "month")} old`;
  return a.months ? `${a.years}y ${a.months}m old` : `${plural(a.years, "year")} old`;
}

export function ageLong(birth: string, date: string): string {
  const a = ageBetween(birth, date);
  if (a.totalDays < 0) return "not born yet";
  const parts: string[] = [];
  if (a.years) parts.push(plural(a.years, "year"));
  if (a.months) parts.push(plural(a.months, "month"));
  if (a.days || !parts.length) parts.push(plural(a.days, "day"));
  return parts.join(", ");
}

/** Days until the first birthday, then decimal years */
export function smartAge(birth: string, on: string = todayISO()): { value: string; unit: string } {
  const a = ageBetween(birth, on);
  if (a.totalDays < 0) return { value: "0", unit: "days old" };
  if (a.years < 1) return { value: String(a.totalDays), unit: a.totalDays === 1 ? "day old" : "days old" };
  return { value: (a.totalDays / 365.25).toFixed(1), unit: "years old" };
}

export function ageTotals(birth: string, on: string = todayISO()) {
  const a = ageBetween(birth, on);
  const totalDays = Math.max(0, a.totalDays);
  return {
    years: (totalDays / 365.25).toFixed(1),
    months: Math.max(0, a.years * 12 + a.months),
    weeks: Math.floor(totalDays / 7),
    days: totalDays,
  };
}

export function ageBucket(birth: string, date: string): string {
  const a = ageBetween(birth, date);
  if (a.totalDays <= 28) return "Newborn";
  const totalMonths = a.years * 12 + a.months;
  if (totalMonths < 12) return plural(totalMonths, "month");
  return a.months ? `${plural(a.years, "year")}, ${a.months} mo` : plural(a.years, "year");
}

export function formatDate(s: string): string {
  const d = parseISO(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "2023:05:17 10:11:12" → "2023-05-17" */
export function exifToISO(s?: string | null): string | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!m || m[1] === "0000") return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Many cameras put the date in the file name: IMG_20240315_101500.jpg, PXL_20240315_... */
export function dateFromFileName(name?: string | null): string | null {
  if (!name) return null;
  const m = name.match(/(20\d{2}|19\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/);
  if (!m) return null;
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** "14:05" → "2:05 PM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
