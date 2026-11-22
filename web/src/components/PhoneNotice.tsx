/**
 * The phone apps only: something the person must read once, as the app opens — today, that their log
 * file was damaged and the copy from before their last change was opened (APP_PORTS/shared/src/open.ts).
 * Like the reminder window, it closes only with its own button.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui";

export function PhoneNotice() {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api.phoneNotice().then((r) => { if (live && r.notice) setNotice(r.notice); }, () => {});
    return () => { live = false; };
  }, []);
  const close = () => { setNotice(null); void api.phoneNoticeSeen().catch(() => {}); };
  return (
    <Dialog.Root open={!!notice} onOpenChange={(o) => { if (!o) return; }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/55" />
        <Dialog.Content aria-describedby="phone-notice-text"
          onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}
          className="fixed top-1/2 left-1/2 z-[70] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface p-5 text-ink shadow-sheet outline-none">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-warn-soft text-warn"><TriangleAlert className="size-6" /></div>
          <Dialog.Title className="mt-3 text-center text-xl font-extrabold tracking-tight">Your log was recovered</Dialog.Title>
          <p id="phone-notice-text" className="mt-3 text-[15px] leading-snug text-ink-2">{notice}</p>
          <Button size="lg" variant="strong" className="mt-4 w-full" onClick={close}>Close</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
