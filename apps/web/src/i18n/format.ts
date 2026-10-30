"use client";

import { useFormatter, useTranslations } from "next-intl";

export type Money = { amount: number; currency: string };

// Dates, numbers and money always go through Intl so they follow the user's language.
export function useFormat() {
  const format = useFormatter();
  const t = useTranslations("time");

  return {
    // `digits` for cents where they matter, e.g. CPL "€11.52".
    money: (value: Money, digits = 0) =>
      format.number(value.amount, {
        style: "currency",
        currency: value.currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
    number: (value: number) => format.number(value),
    // "412.8K" for big counts in tight places.
    compact: (value: number) => format.number(value, { notation: "compact", maximumFractionDigits: 1 }),
    percent2: (value: number) => format.number(value, { style: "percent", maximumFractionDigits: 2 }),
    // "1 Jun – 30 Jun 2026", following the language's rules for ranges.
    dateRange: (start: Date | string, end: Date | string) =>
      format.dateTimeRange(new Date(start), new Date(end), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
    decimal: (value: number) => format.number(value, { maximumFractionDigits: 1 }),
    // "€35K" for chart axes.
    compactMoney: (value: Money) =>
      format.number(value.amount, { style: "currency", currency: value.currency, notation: "compact", maximumFractionDigits: 1 }),
    percent: (value: number) => format.number(value, { style: "percent", maximumFractionDigits: 1 }),
    // "+12%" / "-3%" for changes.
    signedPercent: (value: number) =>
      format.number(value, { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1 }),
    date: (value: Date | string) =>
      format.dateTime(new Date(value), { dateStyle: "medium" }),
    relative: (value: Date | string) => format.relativeTime(new Date(value), new Date()),
    // Like the design: "Today, 09:42", "Yesterday, 16:18", "Mon, 14:30", then a date.
    recent: (value: Date | string) => {
      const date = new Date(value);
      const time = format.dateTime(date, { hour: "numeric", minute: "2-digit" });
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / (24 * 60 * 60 * 1000));
      if (days === 0) return t("todayAt", { time });
      if (days === 1) return t("yesterdayAt", { time });
      if (days > 1 && days < 7) return t("weekdayAt", { day: format.dateTime(date, { weekday: "short" }), time });
      return format.dateTime(date, { dateStyle: "medium" });
    },
    // Short day and month for cards ("28 Oct", "28. Okt.", "10月28日").
    dayMonth: (value: Date | string) =>
      format.dateTime(new Date(value), { day: "numeric", month: "short" }),
    // Weekday name for dates later this week ("Friday", "Freitag", "星期五").
    weekday: (value: Date | string) => format.dateTime(new Date(value), { weekday: "long" }),
    // "June 2026", "Juni 2026", "2026年6月".
    monthYear: (value: Date | string) => format.dateTime(new Date(value), { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}
