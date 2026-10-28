import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import config from "./locales.json";

const dir = join(__dirname, "../../messages");
const load = (code: string) => JSON.parse(readFileSync(join(dir, `${code}.json`), "utf8"));

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

describe("translation files", () => {
  const base = keys(load(config.defaultLocale)).sort();

  it("exist for every configured language and nothing else", () => {
    const files = readdirSync(dir).map((f) => f.replace(".json", "")).sort();
    expect(files).toEqual(config.locales.map((l) => l.code).sort());
  });

  it.each(config.locales.map((l) => l.code))("%s has the same keys as the default language", (code) => {
    expect(keys(load(code)).sort()).toEqual(base);
  });

  it.each(config.locales.map((l) => l.code))("%s has no empty strings", (code) => {
    const flat = keys(load(code)).map((path) => path.split(".").reduce((o, k) => o[k], load(code)));
    expect(flat.filter((v) => typeof v !== "string" || v.trim() === "")).toEqual([]);
  });
});
