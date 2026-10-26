/**
 * Themes: Light and Dark are token sets in index.css; "system" follows the phone or computer; a
 * custom theme sets the same CSS variables inline on <html>.
 */
import type { CustomTheme } from "../../../shared/types";

/** The colours a custom theme can set, with the label Settings shows. */
export const THEME_TOKENS: [string, string][] = [
  ["bg", "Page background"], ["surface", "Cards"], ["surface-2", "Inner boxes"], ["ink", "Text"], ["mute", "Secondary text"],
  ["line", "Lines"], ["accent", "Accent (+ Splurge, links)"], ["accent-ink", "Text on accent"], ["strong", "Weigh in button"],
  ["strong-ink", "Text on Weigh in"], ["snack", "Snack"], ["meal", "Meal"], ["feast", "Feast"],
  ["note", "Goal note"], ["note-ink", "Text on the goal note"],
];

const media = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

export function applyTheme(theme: string, custom: CustomTheme[], preview?: CustomTheme | null): void {
  const root = document.documentElement;
  for (const [k] of THEME_TOKENS) root.style.removeProperty(`--${k}`);
  const ct = preview || custom.find((t) => t.id === theme);
  if (ct) {
    root.dataset.theme = ct.dark ? "dark" : "light";
    for (const [k] of THEME_TOKENS) if (ct.tokens[k]) root.style.setProperty(`--${k}`, ct.tokens[k]);
  } else {
    root.dataset.theme = theme === "dark" || (theme === "system" && media?.matches) ? "dark" : "light";
  }
  // the phone's own bars follow the page
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", getComputedStyle(root).getPropertyValue("--bg").trim() || "#f6f7f9");
}

/** The theme last used in this browser, so the first paint (and the sign-in screen) already wears it. */
const REMEMBERED = "jt.appearance";
export function rememberTheme(theme: string, custom: CustomTheme[]): void {
  try { localStorage.setItem(REMEMBERED, JSON.stringify({ theme, customThemes: custom.filter((t) => t.id === theme) })); } catch {}
}
export function applyRememberedTheme(): void {
  try {
    const a = JSON.parse(localStorage.getItem(REMEMBERED) || "null") as { theme?: unknown; customThemes?: unknown } | null;
    if (a && typeof a.theme === "string") { applyTheme(a.theme, Array.isArray(a.customThemes) ? (a.customThemes as CustomTheme[]) : []); return; }
  } catch {}
  applyTheme("system", []);
}

export function onSystemThemeChange(fn: () => void): () => void {
  media?.addEventListener("change", fn);
  return () => media?.removeEventListener("change", fn);
}

/** The colours on screen now — a new custom theme starts from these. */
export function currentTokens(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  for (const [k] of THEME_TOKENS) out[k] = toHex(cs.getPropertyValue(`--${k}`).trim());
  return out;
}
function toHex(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + c.slice(1).split("").map((x) => x + x).join("").toLowerCase();
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("") : "#888888";
}
