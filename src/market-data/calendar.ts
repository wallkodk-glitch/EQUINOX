import sessions from "./sessions.json";
import { requireThat } from "../domain/core";
export const CALENDAR_POLICY = "US_REGULAR_CLOSE_2024_2027_V1";
export const CALENDAR_SOURCES = [
  "https://www.nyse.com/trade/hours-calendars",
  "https://ir.theice.com/press/news-details/2023/NYSE-Group-Announces-2024-2025-and-2026-Holiday-and-Early-Closings-Calendar/default.aspx",
  "https://www.nasdaqtrader.com/TraderNews.aspx?id=ETA2024-87",
];
export function sessionWindow(now: string, lookback: number) {
  const ms = Date.parse(now);
  requireThat(
    Number.isFinite(ms) && now >= "2024-01-01" && now < "2028-01-01",
    "CALENDAR_OUT_OF_RANGE",
  );
  requireThat(
    Number.isInteger(lookback) && lookback >= 252 && lookback <= 756,
    "INVALID_LOOKBACK",
  );
  // Two-hour close-data publication allowance; NEVER classify this allowance as live.
  const available = sessions.filter(
    (s) => Date.parse(s.close) + 2 * 3600e3 <= ms,
  );
  requireThat(available.length >= lookback + 1, "INSUFFICIENT_HISTORY");
  return available.slice(-lookback - 1);
}
