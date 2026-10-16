/** Small shared pieces. Colours only from theme tokens. */
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { SIZE_LABEL, type Size } from "../../../shared/types";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "accent" | "strong" | "outline" | "soft" | "ghost" | "danger";
const VARIANT: Record<Variant, string> = {
  accent: "bg-accent text-accent-ink hover:brightness-105",
  strong: "bg-strong text-strong-ink hover:brightness-110",
  outline: "border border-line-2 bg-surface text-ink hover:bg-surface-2",
  soft: "bg-accent-soft text-accent-text hover:brightness-97",
  ghost: "text-ink hover:bg-surface-2",
  danger: "border border-line-2 bg-surface text-danger hover:bg-danger-soft",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" | "xl" }>(
  ({ variant = "outline", size = "md", className, type = "button", ...rest }, ref) => (
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
  ),
);

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-2xl border border-line bg-surface shadow-soft", className)}>{children}</section>;
}

export function Label({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-bold text-mute">
      {children} {required ? <span className="text-danger" aria-hidden>*</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...rest }, ref) => (
  <input ref={ref} className={cx("h-12 w-full min-w-0 rounded-xl border border-line-2 bg-surface px-3.5 text-ink placeholder:text-faint focus:border-accent", className)} {...rest} />
));
export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...rest }, ref) => (
  <textarea ref={ref} className={cx("w-full rounded-xl border border-line-2 bg-surface px-3.5 py-2.5 text-ink placeholder:text-faint focus:border-accent", className)} {...rest} />
));

/** A labelled box: <Field label="Where"><Input …/></Field> */
export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} required={required}>{label}</Label>
      {children(id)}
      {hint ? <p className="mt-1 text-xs text-mute">{hint}</p> : null}
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
  return (
    <button role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
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

export function SizeLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
      {(["snack", "meal", "feast"] as Size[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5"><span className={cx("size-2.5 rounded-[3px]", SIZE_DOT[s])} />{SIZE_LABEL[s]}</span>
      ))}
    </div>
  );
}

/**
 * A sheet: slides up from the bottom on a phone, a centred panel on a wider screen. Closes on Esc,
 * the X, or a tap outside.
 */
export function Sheet({ open, onOpenChange, title, subtitle, children, actions }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode;
}) {
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
  return (
    <form className="space-y-4 pb-2" onSubmit={async (e) => { e.preventDefault(); const typed = new FormData(e.currentTarget).get("word"); if (word && typed !== word) return; await onConfirm(); }}>
      <div className="text-[15px] leading-relaxed text-ink-2">{body}</div>
      {word ? (
        <div>
          <Label htmlFor={id}>Type {word} to confirm</Label>
          <Input id={id} name="word" autoComplete="off" autoCapitalize="characters" />
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
  return text ? <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{text}</p> : null;
}
