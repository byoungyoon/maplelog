import type { Cycle } from "./model";
const DAY = 86400000,
  KST = 9 * 3600000;
// This reset rule is a versioned demo fixture, not a claim about all live bosses.
export function periodAt(at: string | Date, cycle: Cycle) {
  const d = new Date(new Date(at).getTime() + KST);
  d.setUTCHours(0, 0, 0, 0);
  if (cycle === "weekly")
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 3) % 7));
  if (cycle === "monthly") d.setUTCDate(1);
  const start = d.getTime() - KST;
  if (cycle === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setTime(d.getTime() + DAY * (cycle === "weekly" ? 7 : 1));
  return {
    start: new Date(start).toISOString(),
    end: new Date(d.getTime() - KST).toISOString(),
  };
}
export function periodLabel(start: string, end: string) {
  const fmt = (v: string) =>
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date(v))
      .replace(/\.$/, "");
  return `${fmt(start)} – ${fmt(new Date(new Date(end).getTime() - 1).toISOString())}`;
}
export function timeLabel(v: string | null) {
  return v
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(v))
    : "아직 확인하지 않음";
}
