/**
 * What the page may save in the settings, each checked (the first problem becomes the sentence the
 * person sees). Kept apart from app.ts so the phone apps (APP_PORTS/) check settings the same way.
 */
import { z } from "zod";
import { QUICK_PICK_MAX, REMINDER_DAYS_MAX, REMINDER_DAYS_MIN } from "../../shared/types.js";

const REMINDER_DAYS_ERROR = `A reminder waits ${REMINDER_DAYS_MIN} to ${REMINDER_DAYS_MAX} days (a whole number).`;

export const themeSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  name: z.string().trim().min(1, "Give the theme a name.").max(40),
  dark: z.boolean(),
  tokens: z.record(z.string().regex(/^[a-z0-9-]{1,30}$/), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours are #rrggbb.")),
});
const hostName = z.string().trim().toLowerCase().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/, "Other names are plain host names, like my-mac.tailnet-name.ts.net — no http:// or port.");
/** Only these app settings can be changed from the page, each checked. */
export const settingsSchema = z.object({
  server: z.object({
    port: z.number().int().min(1024, "Use a port from 1024 to 65535.").max(65535, "Use a port from 1024 to 65535."),
    allowNetwork: z.boolean(),
    extraHosts: z.array(hostName).max(20),
  }).partial(),
  // signing in is turned on and off with /api/auth/enable and /disable (they set or remove the password), never here
  security: z.object({ sessionDays: z.number().int().min(1).max(365) }).partial().strict(),
  appearance: z.object({ theme: z.string().max(40), customThemes: z.array(themeSchema).max(30) }).partial(),
}).partial().strict();

export const userSettingsSchema = z.object({
  units: z.enum(["lb", "kg"]),
  trendDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  examples: z.object({ snack: z.string().max(120), meal: z.string().max(120), feast: z.string().max(120) }).partial(),
  // the six quick picks on Log activity, in order ("" = the default one)
  openIn: z.enum(["tracker", "game"], { error: "Open in the tracker or in game mode." }),
  autoStart: z.boolean({ error: "Keep the monsters coming is on or off." }),
  toughness: z.enum(["standard", "tough", "brutal"], { error: "Pick Standard, Tough or Brutal." }),
  weighReminder: z.boolean({ error: "The weigh-in reminder is on or off." }),
  activityReminder: z.boolean({ error: "The activity reminder is on or off." }),
  weighReminderDays: z.number({ error: REMINDER_DAYS_ERROR }).int(REMINDER_DAYS_ERROR).min(REMINDER_DAYS_MIN, REMINDER_DAYS_ERROR).max(REMINDER_DAYS_MAX, REMINDER_DAYS_ERROR),
  activityReminderDays: z.number({ error: REMINDER_DAYS_ERROR }).int(REMINDER_DAYS_ERROR).min(REMINDER_DAYS_MIN, REMINDER_DAYS_ERROR).max(REMINDER_DAYS_MAX, REMINDER_DAYS_ERROR),
  healthImport: z.boolean({ error: "Bringing in workouts is on or off." }),
  healthSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "That is not a real date.").nullable(),
  quickPicks: z.array(z.string().max(QUICK_PICK_MAX, `Keep each quick pick under ${QUICK_PICK_MAX} characters.`), { error: "The quick picks are six names." }).max(6, "There are six quick picks."),
}).partial().strict();
