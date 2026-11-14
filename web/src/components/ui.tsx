/** Small shared pieces. Colours only from theme tokens. */
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { createContext, forwardRef, useContext, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { SIZE_LABEL, type Size } from "../../../shared/types";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * The look of a sheet's parts: "tracker" (the app as always) or "game" (Calorie Crusher's chunky
 * skin, the `.g-*` classes in index.css). One form, two skins: LogSheet and ActivitySheet set it,
 * and the pieces below (and DayPicker) read it, so the fields, their order and labels never differ.
 */
export type Skin = "tracker" | "game";
export const SkinContext = createContext<Skin>("tracker");
export const useSkin = () => useContext(SkinContext);

/** "Matt Walker" → "MW": the round bubble on Home and in Settings */
export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

type Variant = "accent" | "active" | "strong" | "outline" | "soft" | "ghost" | "danger";
/** The game skin's fills: + Splurge's save is blue and + Activity's green, like the game's bottom buttons. */
const GAME_VARIANT: Record<Variant, string> = {
  accent: "g-btn bg-g-blue font-game text-[22px] font-normal g-stroke-thin",
  active: "g-btn bg-g-green font-game text-[22px] font-normal g-stroke-thin",
  strong: "g-btn bg-g-night text-g-night-ink",
  outline: "g-btn bg-g-panel-2 text-g-text font-black",
  soft: "g-btn bg-g-soft-yellow text-g-text",
  ghost: "text-g-text",
  danger: "g-btn bg-g-panel-2 text-g-red font-black",
};
const VARIANT: Record<Variant, string> = {
  accent: "bg-accent text-accent-ink hover:brightness-105",
  active: "bg-active text-active-ink hover:brightness-105",
  strong: "bg-strong text-strong-ink hover:brightness-110",
  outline: "border border-line-2 bg-surface text-ink hover:bg-surface-2",
  soft: "bg-accent-soft text-accent-text hover:brightness-97",
  ghost: "text-ink hover:bg-surface-2",
  danger: "border border-line-2 bg-surface text-danger hover:bg-danger-soft",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" | "xl" }>(
  ({ variant = "outline", size = "md", className, type = "button", ...rest }, ref) => {
    const skin = useSkin();
    if (skin === "game") {
      return (
        <button ref={ref} type={type} {...rest}
          className={cx("inline-flex items-center justify-center gap-2",
            size === "sm" && "h-9 rounded-xl px-3 text-sm",
            size === "md" && "h-11 rounded-xl px-4 text-[15px]",
            size === "lg" && "h-12 rounded-xl px-5 text-base",
            size === "xl" && "h-[60px] rounded-[18px] px-5",
            GAME_VARIANT[variant], className)} />
      );
    }
    return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-bold transition disabled:opacity-50",
        size === "sm" && "h-9 rounded-lg px-3 text-sm",
        size === "md" && "h-11 rounded-xl px-4 text-[15px]",
        size === "lg" && "h-12 rounded-xl px-5 text-base",
        size === "xl" && "h-[58px] rounded-2xl px-5 text-[17px] font-extrabold",
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
    );
  },
);

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-2xl border border-line bg-surface shadow-soft", className)}>{children}</section>;
}

export function Label({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  if (useSkin() === "game") {
    return (
      <label htmlFor={htmlFor} className="mb-[7px] block font-game text-[17px] text-g-text">
        {children} {required ? <span className="text-g-red" aria-hidden>*</span> : null}
      </label>
    );
  }
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-bold text-mute">
      {children} {required ? <span className="text-danger" aria-hidden>*</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...rest }, ref) => {
  if (useSkin() === "game") return <input ref={ref} className={cx("g-field h-[50px] w-full min-w-0 rounded-[14px] px-[13px] text-[17px] font-extrabold", className)} {...rest} />;
  return <input ref={ref} className={cx("h-12 w-full min-w-0 rounded-xl border border-line-2 bg-surface px-3.5 text-ink placeholder:text-faint focus:border-accent", className)} {...rest} />;
});
export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...rest }, ref) => {
  if (useSkin() === "game") return <textarea ref={ref} className={cx("g-field w-full resize-none rounded-[14px] px-3 py-2.5 font-bold", className)} {...rest} />;
  return <textarea ref={ref} className={cx("w-full rounded-xl border border-line-2 bg-surface px-3.5 py-2.5 text-ink placeholder:text-faint focus:border-accent", className)} {...rest} />;
});

/** A labelled box: <Field label="Where"><Input …/></Field> */
export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  const game = useSkin() === "game";
  return (
    <div>
      <Label htmlFor={id} required={required}>{label}</Label>
      {children(id)}
      {hint ? <p className={game ? "mt-1 text-xs font-extrabold text-g-mute" : "mt-1 text-xs text-mute"}>{hint}</p> : null}
    </div>
  );
}

/** A row of choices, one picked (Units: lb | kg). */
export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map(([v, text]) => (
        <button key={String(v)} role="radio" aria-checked={v === value} onClick={() => onChange(v)}
          className={cx("min-h-9 rounded-lg px-3 text-sm font-semibold", v === value ? "bg-surface text-ink shadow-soft" : "text-mute")}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** A switch with its label. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  if (useSkin() === "game") {
    return (
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className={cx("relative h-[30px] w-[50px] shrink-0 rounded-full border-[3px] border-g-line transition", checked ? "bg-g-green" : "bg-g-panel-2")}>
        <span className={cx("absolute top-[2px] size-5 rounded-full border-2 border-g-line bg-white transition-all", checked ? "left-[22px]" : "left-[2px]")} />
      </button>
    );
  }
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-accent" : "bg-line-2")}>
      <span className={cx("absolute top-0.5 size-6 rounded-full bg-surface shadow transition", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export const SIZE_FILL: Record<Size, string> = { snack: "bg-snack text-snack-ink", meal: "bg-meal text-meal-ink", feast: "bg-feast text-feast-ink" };
export const SIZE_DOT: Record<Size, string> = { snack: "bg-snack", meal: "bg-meal", feast: "bg-feast" };

export function SizeBadge({ size }: { size: Size }) {
  return <span className={cx("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold", SIZE_FILL[size])}>{SIZE_LABEL[size]}</span>;
}

export function SizeLegend({ active }: { active?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
      {(["snack", "meal", "feast"] as Size[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5"><span className={cx("size-2.5 rounded-[3px]", SIZE_DOT[s])} />{SIZE_LABEL[s]}</span>
      ))}
      {active ? <span className="inline-flex items-center gap-1.5"><span className="notch h-1 w-3.5 rounded-full" />Active</span> : null}
    </div>
  );
}

/** The mark under the date of a day with an activity, coloured to show on that day's colour (index.css). */
export function ActiveNotch({ size, on }: { size: Size | null; on: boolean }) {
  return <span aria-hidden className={cx("h-1 w-3.5 rounded-full", on && (size === "meal" || size === "feast" ? "notch-ink" : size === "snack" ? "notch notch-snack" : "notch"))} />;
}

/**
 * A sheet: slides up from the bottom on a phone, a centred panel on a wider screen. Closes on Esc,
 * the X, or a tap outside.
 */
export function Sheet({ open, onOpenChange, title, subtitle, children, actions, skin = "tracker", lead, titleNode }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode;
  /** "game": Calorie Crusher's chunky sheet; its children see the skin too */
  skin?: Skin;
  /** game skin: a badge before the title (the monster, a sword) */
  lead?: ReactNode;
  /** game skin: the title as words with style ("Attack! Log activity"); `title` stays its plain name */
  titleNode?: ReactNode;
}) {
  if (skin === "game") {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[#2b1d3a]/55" />
          <Dialog.Content aria-describedby={undefined}
            className="game fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[26px] border-[3px] border-b-0 border-g-line bg-g-panel text-g-text outline-none sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[26px] sm:border-b-[3px]">
            <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-g-line opacity-25" aria-hidden />
            <div className="flex items-center gap-2.5 px-4 pt-2 pb-2">
              {lead}
              <Dialog.Title className="min-w-0 flex-1 font-game text-[26px] leading-[1.05] font-normal">{titleNode ?? title}</Dialog.Title>
              {actions}
              <Dialog.Close className="g-btn grid size-10 shrink-0 place-items-center rounded-full bg-g-panel-2 text-g-text" aria-label="Close"><X className="size-5" strokeWidth={3} /></Dialog.Close>
            </div>
            <SkinContext.Provider value="game">
              <div className="pb-safe min-h-0 overflow-y-auto px-4 pt-1">{children}</div>
            </SkinContext.Provider>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-sheet outline-none sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-2 sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2">
            <div className="min-w-0">
              <Dialog.Title className="text-xl font-extrabold tracking-tight">{title}</Dialog.Title>
              {subtitle ? <div className="text-[13px] text-mute">{subtitle}</div> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {actions}
              <Dialog.Close className="grid size-10 place-items-center rounded-xl text-mute hover:bg-surface-2" aria-label="Close"><X className="size-5" /></Dialog.Close>
            </div>
          </div>
          <div className="pb-safe min-h-0 overflow-y-auto px-5 pt-1">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** "Are you sure?" — with a word to type for the destructive ones. */
export function Confirm({ open, onOpenChange, title, body, confirmLabel, word, danger, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; body: ReactNode; confirmLabel: string; word?: string; danger?: boolean; onConfirm: () => void | Promise<void>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <ConfirmBody body={body} confirmLabel={confirmLabel} word={word} danger={danger} onConfirm={onConfirm} onCancel={() => onOpenChange(false)} />
    </Sheet>
  );
}
function ConfirmBody({ body, confirmLabel, word, danger, onConfirm, onCancel }: { body: ReactNode; confirmLabel: string; word?: string; danger?: boolean; onConfirm: () => void | Promise<void>; onCancel: () => void }) {
  const id = useId();
  const [wrong, setWrong] = useState(false);
  return (
    <form className="space-y-4 pb-2" onSubmit={async (e) => { e.preventDefault(); const typed = String(new FormData(e.currentTarget).get("word") ?? "").trim().toUpperCase(); if (word && typed !== word) { setWrong(true); return; } await onConfirm(); }}>
      <div className="text-[15px] leading-relaxed text-ink-2">{body}</div>
      {word ? (
        <div>
          <Label htmlFor={id}>Type {word} to confirm</Label>
          <Input id={id} name="word" autoComplete="off" autoCapitalize="characters" onChange={() => setWrong(false)} />
          {wrong ? <p role="alert" className="mt-1.5 text-sm text-danger">Type {word} in the box to confirm.</p> : null}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2.5">
        <Button size="lg" onClick={onCancel}>Cancel</Button>
        <Button size="lg" type="submit" variant={danger ? "danger" : "accent"}>{confirmLabel}</Button>
      </div>
    </form>
  );
}

export function ErrorLine({ text }: { text: string | null }) {
  const game = useSkin() === "game";
  if (game && text) {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-[14px] border-[2.5px] border-g-line bg-g-soft-red px-2.5 py-2 text-sm font-extrabold">
        <span aria-hidden className="grid size-[22px] shrink-0 place-items-center rounded-full border-2 border-g-line bg-g-red font-game text-sm text-white">!</span>
        <span>{text}</span>
      </p>
    );
  }
  return text ? <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{text}</p> : null;
}
