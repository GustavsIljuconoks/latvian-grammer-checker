import { t } from "@/i18n";

export { countWords } from "../../../shared/types";

const timeFormat = new Intl.DateTimeFormat("lv-LV", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("lv-LV", { day: "numeric", month: "short" });
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export type DayGroup = "today" | "yesterday" | "earlier";

export function dayGroup(iso: string, now = new Date()): DayGroup {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : "earlier";
}

export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

export function formatShortDate(iso: string): string {
  const group = dayGroup(iso);
  const day = group === "today" ? t.dates.today : group === "yesterday" ? t.dates.yesterday : dayFormat.format(new Date(iso));
  return `${day}, ${formatTime(iso)}`;
}

export function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
