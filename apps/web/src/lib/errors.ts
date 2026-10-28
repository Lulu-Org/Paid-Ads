"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api";

// Turns any thrown error into a translated message. Unknown codes fall back to a generic message.
export function useErrorMessage() {
  const t = useTranslations("errors");
  return (error: unknown) => {
    const code = error instanceof ApiError ? error.code : "UNKNOWN_ERROR";
    return t.has(code) ? t(code) : t("UNKNOWN_ERROR");
  };
}
