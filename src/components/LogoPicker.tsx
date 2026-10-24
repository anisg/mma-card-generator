import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import ufcLogoSvg from "../../public/brand/ufc.svg?raw";
import { useCardStore } from "../store";
import { Popover } from "./ui";

// Crop the square source viewBox to the logo's actual bounds.
const ufcLogo = ufcLogoSvg
  .replace(/\s(width|height)="[^"]*"/g, "")
  .replace('viewBox="0 0 14 14"', 'viewBox="1 4.96 12 4.08" class="block w-full h-auto"');

export function EventLogo() {
  const eventType = useCardStore((s) => s.eventType);
  const eventNumber = useCardStore((s) => s.eventNumber);

  if (eventType === "fight-night") {
    return <img src="/brand/ufc-fight-night.webp" alt="UFC Fight Night" className="h-[158px] w-[280px]" />;
  }
  return (
    <div className="flex h-[158px] w-[280px] items-center justify-center bg-black">
      <div className="flex w-[190px] flex-col gap-2 text-white">
        <div dangerouslySetInnerHTML={{ __html: ufcLogo }} />
        <div className="flex items-center gap-3">
          <div className="h-[6px] min-w-[24px] flex-1 -skew-x-12 bg-white" />
          <span className="text-[44px] leading-none font-bold whitespace-nowrap italic">{eventNumber}</span>
        </div>
      </div>
    </div>
  );
}

export function LogoPicker() {
  const [open, setOpen] = useState(false);
  const [numberDialog, setNumberDialog] = useState(false);
  const eventType = useCardStore((s) => s.eventType);
  const eventNumber = useCardStore((s) => s.eventNumber);
  const setEvent = useCardStore((s) => s.setEvent);
  const [draft, setDraft] = useState(eventNumber);

  const optionClass = (active: boolean) =>
    `w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 ${active ? "font-semibold" : ""}`;

  return (
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
        className="w-48 p-1.5"
        trigger={
          <button type="button" aria-label="Change event type" className="transition hover:brightness-125">
            <EventLogo />
          </button>
        }
      >
        <button
          type="button"
          className={optionClass(eventType === "fight-night")}
          onClick={() => {
            setEvent("fight-night");
            setOpen(false);
          }}
        >
          Fight Night
        </button>
        <button
          type="button"
          className={optionClass(eventType === "numbered")}
          onClick={() => {
            setDraft(eventNumber);
            setOpen(false);
            setNumberDialog(true);
          }}
        >
          Numbered
        </button>
      </Popover>

      <Dialog.Root open={numberDialog} onOpenChange={setNumberDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl outline-none">
            <Dialog.Title className="text-lg font-semibold">Event number</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-neutral-500">Displayed as “UFC {draft || "…"}”.</Dialog.Description>
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                setEvent("numbered", draft.trim());
                setNumberDialog(false);
              }}
            >
              <input
                autoFocus
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
              />
              <button type="submit" className="rounded-xl bg-neutral-900 py-2 font-medium text-white">
                Save
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
