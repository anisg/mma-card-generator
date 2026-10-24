import { useState, type ReactNode } from "react";
import * as RadixPopover from "@radix-ui/react-popover";

type PopoverProps = {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
};

export function Popover({ trigger, children, open, onOpenChange, side = "bottom", align = "center", className = "" }: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className={`z-50 rounded-2xl border border-neutral-200 bg-white p-3 text-neutral-900 shadow-xl outline-none ${className}`}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

type EditableTextProps = {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  inputClassName?: string;
};

/** Click to edit; commits on Enter or blur, Escape cancels. */
export function EditableText({ value, onCommit, className = "", inputClassName = "" }: EditableTextProps) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button type="button" onClick={() => setDraft(value)} className={`cursor-text rounded hover:outline-2 hover:outline-dashed hover:outline-white/60 ${className}`}>
        {value}
      </button>
    );
  }

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    setDraft(null);
  };

  return (
    <input
      autoFocus
      value={draft}
      size={Math.max(draft.length, 2)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(null);
      }}
      className={`rounded bg-white/10 text-center outline-2 outline-white/70 ${className} ${inputClassName}`}
    />
  );
}

export function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function RemoveButton({ onClick, label, className = "" }: { onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      data-export-ignore=""
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex size-7 items-center justify-center rounded-full bg-white text-lg leading-none font-bold text-black shadow ring-2 ring-black ${className}`}
    >
      ×
    </button>
  );
}

export function AddButton({ onClick, label, className = "" }: { onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      data-export-ignore=""
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex items-center justify-center rounded-2xl border-4 border-dashed border-white/70 text-5xl font-light text-white/80 transition hover:border-white hover:bg-white/10 hover:text-white ${className}`}
    >
      +
    </button>
  );
}
