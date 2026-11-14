/**
 * Craving Crusher's words and numbers for the screens: the deadline countdown, the "So close!"
 * nudge, the deadline cards on Choose your fight, the battle log rows and the live damage or heal
 * panel in the game-skinned sheets. Pure (tested in test/gameui.test.ts). The panel numbers come
 * from the shared engine's `preview()`, so they are what the server will do.
 */
import { BET_LABEL, bonusMaxOf, levelInfo, POINTS, preview, type ActivityEv, type BattleLine, type Bet, type FightInput, type SplurgeEv } from "../../../shared/game";
import type { Day, Size } from "../../../shared/types";
import { SIZE_LABEL } from "../../../shared/types";

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (n: number) => n.toLocaleString("en-US");
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymd = (d: Day) => d.split("-").map(Number) as [number, number, number];
const utcDay = (d: Day) => { const [y, m, dd] = ymd(d); return new Date(Date.UTC(y, m - 1, dd)); };

/** "Sat Nov 14" */
export function shortDate(d: Day): string {
  const t = utcDay(d);
  return `${WEEKDAY_SHORT[t.getUTCDay()]} ${MON[t.getUTCMonth()]} ${t.getUTCDate()}`;
}
/** whole days from a to b */
export function daysFrom(a: Day, b: Day): number {
  return Math.round((utcDay(b).getTime() - utcDay(a).getTime()) / 86_400_000);
}

// ---------------------------------------------------------------- the deadline

/**
 * A fight ends at midnight at the end of its last day, on the phone's own clock: a log made at
 * 23:59 still counts (the server reads the day, not the minute).
 */
export function deadlineMoment(deadlineOn: Day): Date {
  const [y, m, d] = ymd(deadlineOn);
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0);
}

/** "Due end of Sat Nov 14": how every screen names a deadline. */
export const dueText = (deadlineOn: Day): string => `end of ${shortDate(deadlineOn)}`;

export interface Countdown {
  /** seconds left (0 once it has passed) */
  secs: number;
  passed: boolean;
  /** "3 · 04:11:46" (days · hours:minutes:seconds) */
  digits: string;
  /** "3 days 4 h left", "5 h 12 min left", "12 min left", "Time’s up!": the same words on every screen (the map's flag, the Monster Book) */
  big: string;
  /** "DUE END OF SAT NOV 14" */
  kicker: string;
}

export function countdown(deadlineOn: Day, now: Date): Countdown {
  const secs = Math.max(0, Math.floor((deadlineMoment(deadlineOn).getTime() - now.getTime()) / 1000));
  const d = Math.floor(secs / 86400), h = Math.floor(secs / 3600) % 24, m = Math.floor(secs / 60) % 60, s = secs % 60;
  const big = secs === 0 ? "Time’s up!"
    : d ? `${d} ${d === 1 ? "day" : "days"}${h ? ` ${h} h` : ""} left`
    : h ? `${h} h${m ? ` ${m} min` : ""} left`
    : m ? `${m} min left` : "Under a minute left";
  return {
    secs, passed: secs === 0, big,
    digits: `${d} · ${pad(h)}:${pad(m)}:${pad(s)}`,
    kicker: secs === 0 ? "DEADLINE PASSED" : `DUE ${dueText(deadlineOn).toUpperCase()}`,
  };
}

// ---------------------------------------------------------------- "So close!"

/** A workout that would do `dmg` damage, as a person would do it: "a 45-min run burning 470 cal". */
export function mixFor(dmg: number): string {
  if (dmg <= 0) return "any workout";
  if (dmg <= 20) return `one ${dmg}-min walk`;
  if (dmg <= 45) return `a 20-min walk burning ${fmt((dmg - 20) * 10)} cal`;
  if (dmg <= 100) return `a 45-min run burning ${fmt((dmg - 45) * 10)} cal`;
  return `a 60-min ride burning ${fmt((dmg - 60) * 10)} cal`;
}

export interface SoClose { title: string; hp: number; minutes: string; calories: string; mix: string }
/** The nudge on the battle screen: what would finish the monster, in minutes and in calories (10 min = 100 cal = 10 damage). */
/**
 * HP as the screens write it: "92 / 250", or with bonus HP (a splurge past full) "250 / 250 +20".
 * `total` is HP + bonus HP (bonus HP only exists on top of a full bar).
 */
export function hpText(total: number, max: number, sep = " / "): string {
  const t = Math.max(0, total);
  return t > max ? `${fmt(max)}${sep}${fmt(max)} +${fmt(t - max)}` : `${fmt(t)}${sep}${fmt(max)}`;
}
/** The short form for "before → after": "92", or "250+20" with bonus HP. */
export const hpShort = (total: number, max: number): string => { const t = Math.max(0, total); return t > max ? `${fmt(max)}+${fmt(t - max)}` : fmt(t); };
/** A fight's HP left, bonus HP included (what a workout has to get through). */
export const hpLeft = (f: { hp: number; bonus?: number }): number => f.hp + (f.bonus ?? 0);

export function soClose(hp: number): SoClose {
  return {
    title: hp <= 0 ? "Finished!" : hp <= 100 ? "So close!" : "Still in reach!",
    hp, minutes: fmt(hp), calories: fmt(hp * 10), mix: mixFor(hp),
  };
}

// ---------------------------------------------------------------- Choose your fight

export interface BetPlan {
  bet: Bet;
  label: string;
  deadlineOn: Day;
  /** days to fight in, today included */
  days: number;
  /** damage a day that gets it done */
  perDay: number;
  /** "a 35-min walk burning 170 cal" */
  example: string;
  /** what the KO is worth at least (its damage, the kill, the boss bonus, × the bet, × 1.25 on Hardcore) */
  worth: number;
  speedPerDay: number;
  flawless: number;
}

/** A day's damage as one workout: two thirds of it as minutes (to the nearest 5), the rest as calories. */
export function dayExample(perDay: number): string {
  if (perDay <= 20) return `a ${perDay}-min walk`;
  const mins = Math.min(perDay, Math.max(5, Math.round((perDay * 0.67) / 5) * 5));
  const cal = (perDay - mins) * 10;
  return `a ${mins}-min ${mins <= 45 ? "walk" : "run"}${cal ? ` burning ${fmt(cal)} cal` : ""}`;
}

export function betPlan(o: { bet: Bet; deadlineOn: Day }, f: { hp: number; bonus?: number; max: number; boss: boolean }, today: Day, hardcore: boolean): BetPlan {
  const days = Math.max(1, daysFrom(today, o.deadlineOn) + 1);
  const perDay = Math.ceil(Math.max(0, hpLeft(f)) / days);
  const hc = hardcore ? POINTS.hardcore : 1;
  return {
    bet: o.bet, label: BET_LABEL[String(o.bet)] ?? "Steady", deadlineOn: o.deadlineOn, days, perDay, example: dayExample(perDay),
    worth: Math.round((f.max * 2 + (f.boss ? POINTS.boss : 0)) * o.bet * hc),
    speedPerDay: Math.round(POINTS.speedPerDay * o.bet * hc),
    flawless: Math.round(POINTS.flawless * o.bet * hc),
  };
}

// ---------------------------------------------------------------- the battle log

export type LineIcon = "hit" | "crit" | "heal" | "block" | "ko" | "note";
export interface LineRow { key: string; day: string; icon: LineIcon; text: string; value: string; tone: "hit" | "heal" | "crit" | "block" | "plain" }

/**
 * The battle log, newest at the top (Matt, Nov 14 2026), in the order things happened: an entry's
 * own time, or — with no time — when it was logged that day (a splurge, a workout and a second
 * splurge read in that order). One logged on a later day goes at the end of its day. The start of a
 * day (yesterday's leftover heals) comes before its entries and the end (a clean-day crit, a
 * monster's day-end trick) after them; a knockout or a monster's comeback stays with the hit that
 * caused it. `stamp` turns a logged time into the phone's own day and clock.
 */
export function battleLog(lines: BattleLine[], stamp: (iso: string) => { day: Day; time: string } = localStamp): BattleLine[] {
  const seen = new Set<Day>();
  const keyed = lines.map((l, i) => {
    let rank = 1, clock = "";
    if (l.at) {
      seen.add(l.day);
      const logged = stamp(l.at);
      clock = l.time || (logged.day === l.day ? logged.time : "24:00");
    } else rank = seen.has(l.day) ? 2 : 0;
    return { l, i, key: `${l.day} ${rank} ${clock}` };
  });
  keyed.sort((x, y) => (x.key < y.key ? 1 : x.key > y.key ? -1 : y.i - x.i));
  return keyed.map((k) => k.l);
}

const pad2 = (n: number) => String(n).padStart(2, "0");
function localStamp(iso: string): { day: Day; time: string } {
  const t = new Date(iso);
  return { day: `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`, time: `${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}` };
}

export function lineRow(l: BattleLine, today: Day, i: number): LineRow {
  const day = l.day === today ? "Today" : WEEKDAY_SHORT[utcDay(l.day).getUTCDay()];
  const key = `${i}-${l.sourceId ?? l.kind}`;
  switch (l.kind) {
    case "hit": case "potion": return { key, day, icon: "hit", text: l.text, value: `−${l.amount}`, tone: "hit" };
    case "crit": return { key, day, icon: "crit", text: l.text, value: `−${l.amount}`, tone: "crit" };
    case "heal": return { key, day, icon: "heal", text: l.text, value: `+${l.amount}`, tone: "heal" };
    case "revive": return { key, day, icon: "heal", text: l.text, value: `+${l.amount}`, tone: "heal" };
    case "ability": return { key, day, icon: l.amount ? "heal" : "note", text: l.text, value: l.amount ? `+${l.amount}` : "", tone: l.amount ? "heal" : "plain" };
    case "blocked": return { key, day, icon: "block", text: l.text, value: "0", tone: "block" };
    case "ko": return { key, day, icon: "ko", text: l.text, value: "K.O.", tone: "hit" };
    default: return { key, day, icon: "note", text: l.text, value: "", tone: "plain" };
  }
}

// ---------------------------------------------------------------- the live panels in the game-skinned sheets

/** The id a not-yet-saved entry has in a preview. */
export const NEW_ID = "preview-new";

/**
 * When an entry being logged now "was made": the phone's clock, but never before the newest server
 * time in the input (the fight's start, an entry, a potion, the shield going up) — the server will
 * stamp it after all of them, so a phone a little behind must preview it that way too.
 */
export function previewStamp(input: FightInput, nowIso: string): string {
  let newest = input.startedAfter ?? "";
  const see = (t: string | undefined) => { if (t && t > newest) newest = t; };
  for (const e of input.splurges) see(e.createdAt);
  for (const e of input.activities) see(e.createdAt);
  for (const p of input.potions ?? []) see(p.at);
  if (input.shieldFrom && input.shieldFrom !== "start") see(input.shieldFrom.at);
  return newest && nowIso <= newest ? `${newest}~` : nowIso;
}

export interface AttackPanel {
  state: "idle" | "short" | "finish" | "down" | "outside";
  name: string;
  max: number;
  /** its bonus HP cap (20% of max HP) */
  bonusMax: number;
  /** HP before and after, bonus HP included (so either can be over `max`) */
  hpBefore: number;
  hpAfter: number;
  /** this workout's damage (abilities and the comeback ×2 included) */
  dmg: number;
  /** minutes + calories ÷ 10 */
  raw: number;
  /** HP left after it */
  short: number;
  over: number;
  /** "45 min + 210 cal ÷ 10 = 66 damage" */
  formula: string;
  /** the engine's own sentence when an ability or the comeback changed the number */
  note: string;
  /** the words in the box under the HP bar */
  line: string;
}

/** What logging this workout would do to the open fight. `minutes`/`calories` null = left empty. */
export function attackPanel(input: FightInput, a: { id?: string; what: string; day: Day; time: string; minutes: number | null; calories: number | null; createdAt: string }): AttackPanel {
  const lv = levelInfo(input.level);
  const name = lv.name;
  const id = a.id ?? NEW_ID;
  const ev: ActivityEv = { id, what: a.what.trim() || "This workout", day: a.day, time: a.time, minutes: a.minutes, calories: a.calories, createdAt: a.createdAt };
  const { before, after } = preview(input, { activity: ev });
  const minutes = a.minutes ?? 0, cal = a.calories ?? 0;
  const raw = minutes + Math.round(cal / 10);
  const line = after.lines.find((l) => l.sourceId === id && (l.kind === "hit" || l.kind === "note"));
  const dmg = line && line.kind === "hit" ? line.amount : 0;
  const hpBefore = hpLeft(before), hpAfter = hpLeft(after);
  const base = { name, max: lv.hp, bonusMax: bonusMaxOf(lv.hp), hpBefore, hpAfter, raw, dmg, short: Math.max(0, hpAfter), over: 0, note: "" };
  const formula = raw ? `${minutes} min + ${fmt(cal)} cal ÷ 10 = ${raw} damage` : "Damage = minutes + cal ÷ 10, no cap";
  if (before.ko) return { ...base, state: "down", formula, line: `${name} is already down. Logging still earns +5 points.` };
  if (!raw) return { ...base, state: "idle", formula, line: `${name} has ${hpBefore} HP left${before.bonus ? `, ${before.bonus} of it bonus HP` : ""}. Every 10 min or 100 cal is 10 damage.` };
  if (!line) return { ...base, state: "outside", formula, line: `That day is outside ${name}'s fight, so it doesn't hit it. It still earns +5 points.` };
  const note = dmg !== raw ? line.text : "";
  if (after.ko) {
    const over = Math.max(0, dmg - hpBefore);
    return { ...base, state: "finish", over, formula, note, line: `${name} goes down.${over ? ` Overkill by ${over}.` : ""}` };
  }
  const s = Math.max(0, hpAfter);
  return {
    ...base, state: "short", formula, note,
    line: `This hits ${name} for ${dmg} · ${s} short. ${s} more min or ${fmt(s * 10)} more cal would finish it!`,
  };
}

export interface HealPanel {
  /** "full": full HP and a full bonus bar, so it heals nothing */
  state: "none" | "heal" | "blocked" | "full" | "down" | "outside";
  name: string;
  max: number;
  /** its bonus HP cap (20% of max HP) */
  bonusMax: number;
  /** HP before and after, bonus HP included (so either can be over `max`) */
  hpBefore: number;
  hpAfter: number;
  /** HP it would gain (bonus HP included) */
  heal: number;
  /** how much of `heal` goes on as bonus HP (it was full) */
  bonus: number;
  /** "Meal +25" or "+25 ÷ 2 = +13, planned treat" */
  formula: string;
  line: string;
}

/** What logging this splurge would do to the open fight (size null = not picked yet). */
export function healPanel(input: FightInput, s: { id?: string; what: string; day: Day; time: string; size: Size | null; planned: boolean; createdAt: string }): HealPanel {
  const lv = levelInfo(input.level);
  const name = lv.name;
  const base = { name, max: lv.hp, bonusMax: bonusMaxOf(lv.hp) };
  if (!s.size) {
    const hp = hpLeft(preview(input, {}).before);
    return { ...base, state: "none", hpBefore: hp, hpAfter: hp, heal: 0, bonus: 0, formula: "Snack +10 · Meal +25 · Feast +60, or the monster's own numbers", line: `Pick Snack, Meal or Feast to see how much ${name} heals.` };
  }
  const id = s.id ?? NEW_ID;
  const ev: SplurgeEv = { id, what: s.what.trim() || SIZE_LABEL[s.size], day: s.day, time: s.time, size: s.size, planned: s.planned, createdAt: s.createdAt };
  const { before, after } = preview(input, { splurge: ev });
  const line = after.lines.find((l) => l.sourceId === id && (l.kind === "heal" || l.kind === "blocked"));
  const heal = line && line.kind === "heal" ? line.amount : 0;
  const bonus = line && line.kind === "heal" ? line.bonus ?? 0 : 0;
  const plain = { snack: 10, meal: 25, feast: 60 }[s.size];
  // the engine's sentence, without its bonus HP part, ends with the ability's name in brackets
  const core = line ? line.text.replace(/ It (fills up|was at full HP).*$/, "") : "";
  const why = /\(([^)]*)\)\.?$/.exec(core)?.[1] ?? "";
  const ability = why && !why.startsWith("a planned treat") ? why : "";
  const formula = s.planned ? `${SIZE_LABEL[s.size]} heals half: a planned treat${ability ? ` (${ability})` : ""}`
    : ability ? `${SIZE_LABEL[s.size]} +${plain}, ${ability}: +${heal}` : `${SIZE_LABEL[s.size]}: +${plain}`;
  const view = { ...base, hpBefore: hpLeft(before), hpAfter: hpLeft(after), heal, bonus, formula };
  if (before.ko) return { ...view, state: "down", line: `${name} is already down. Logging still earns +5 points.` };
  if (!line) return { ...view, state: "outside", line: `That day is outside ${name}'s fight, so it doesn't heal it. It still earns +5 points.` };
  if (line.kind === "blocked") return { ...view, state: "blocked", line: "BLOCKED! Your Veggie Shield stops this heal." };
  if (!heal) return { ...view, state: "full", line: `${name} is at full HP with a full bonus bar, so this heals nothing.` };
  const extra = !bonus ? "" : bonus === heal ? ` It's at full HP, so it all goes on as bonus HP.` : ` The extra ${bonus} goes on as bonus HP.`;
  return { ...view, state: "heal", line: `${name} heals +${heal}${s.planned ? ", planned treat, half heal" : ability ? ` (${ability})` : ""}.${extra}` };
}

/** The badge under Snack / Meal / Feast: the heal each size would do right now ("+35 heal", "+20 bonus", "maxed out", "blocked"), or "" when it wouldn't count. */
export function sizeHeals(input: FightInput, s: { id?: string; what: string; day: Day; time: string; planned: boolean; createdAt: string }): Record<Size, string> {
  const out = { snack: "", meal: "", feast: "" } as Record<Size, string>;
  for (const size of ["snack", "meal", "feast"] as Size[]) {
    const p = healPanel(input, { ...s, size });
    out[size] = p.state === "heal" ? (p.bonus === p.heal ? `+${p.heal} bonus` : `+${p.heal} heal`) : p.state === "full" ? "maxed out" : p.state === "blocked" ? "blocked" : "";
  }
  return out;
}

/** The toast after a save in game mode: "Logged · Fry Hydra −66". */
export function savedText(kind: "activity" | "splurge", panel: AttackPanel | HealPanel | null): string {
  if (!panel) return "Logged · +5 points";
  if (kind === "activity") {
    const p = panel as AttackPanel;
    return p.dmg > 0 && (p.state === "short" || p.state === "finish") ? `Logged · ${p.name} −${p.dmg}${p.state === "finish" ? " · K.O.!" : ""}` : "Logged · +5 points for an honest log";
  }
  const p = panel as HealPanel;
  return p.state === "heal" ? `Logged · ${p.name} +${p.heal} · +5 points` : p.state === "blocked" ? "Logged · the Veggie Shield blocked it · +5 points" : "Logged · +5 points";
}
