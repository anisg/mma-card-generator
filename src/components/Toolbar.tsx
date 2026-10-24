import { useEffect, useRef, useState, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { downloadDataUrl, renderCardPng } from "../lib";
import { TILE_COLORS, TILE_OPACITY, TILT_COLORS, TILT_OPACITY, useCardStore } from "../store";
import { ImagePicker } from "./ImagePicker";
import { Popover, hexToRgba } from "./ui";

const toolButton = "flex h-11 shrink-0 items-center gap-2 rounded-xl border-2 border-neutral-900 px-2 hover:bg-neutral-100";

export function Toolbar({ cardRef }: { cardRef: RefObject<HTMLDivElement | null> }) {
    return (
        <div className="flex items-center gap-2 rounded-2xl border-2 border-neutral-900 bg-white px-4 py-3">
            <span className="mr-auto min-w-0 truncate font-display text-xl font-bold">UFC Card Generator</span>
            <BackgroundButton />
            <TiltButton />
            <TileButton />
            <ExportDialog cardRef={cardRef} />
        </div>
    );
}

type ExportState = { status: "rendering" } | { status: "ready"; dataUrl: string } | { status: "error" };

function ExportDialog({ cardRef }: { cardRef: RefObject<HTMLDivElement | null> }) {
    const [state, setState] = useState<ExportState | null>(null);
    const dataUrl = state?.status === "ready" ? state.dataUrl : null;

    useEffect(() => {
        if (!dataUrl) return;
        const timer = setTimeout(() => downloadDataUrl(dataUrl, "ufc-card.png"), 1000);
        return () => clearTimeout(timer);
    }, [dataUrl]);

    const open = async () => {
        if (!cardRef.current) return;
        setState({ status: "rendering" });
        try {
            setState({ status: "ready", dataUrl: await renderCardPng(cardRef.current) });
        } catch (err) {
            console.error(err);
            setState({ status: "error" });
        }
    };

    return (
        <Dialog.Root open={state !== null} onOpenChange={(isOpen) => !isOpen && setState(null)}>
            <button
                type="button"
                onClick={open}
                className="h-11 shrink-0 rounded-xl bg-neutral-900 px-5 font-medium text-white hover:bg-neutral-700"
            >
                Export
            </button>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
                <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-white p-5 shadow-xl outline-none">
                    <div className="flex items-center justify-between">
                        <Dialog.Title className="text-lg font-semibold">Export</Dialog.Title>
                        <Dialog.Close aria-label="Close" className="rounded-lg px-2 text-2xl leading-none text-neutral-500 hover:bg-neutral-100">
                            ×
                        </Dialog.Close>
                    </div>
                    <Dialog.Description className="sr-only">Preview of the generated card</Dialog.Description>
                    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
                        {state?.status === "rendering" && <p className="py-24 text-sm text-neutral-500">Generating…</p>}
                        {state?.status === "error" && (
                            <p className="py-24 text-center text-sm text-red-600">Export failed. Some images could not be loaded.</p>
                        )}
                        {dataUrl && <img src={dataUrl} alt="Card preview" className="max-h-[64vh] max-w-full object-contain" />}
                    </div>
                    {dataUrl && <p className="text-center font-medium text-green-700">Successfully created 🎉</p>}
                    <button
                        type="button"
                        disabled={!dataUrl}
                        onClick={() => dataUrl && downloadDataUrl(dataUrl, "ufc-card.png")}
                        className="h-14 rounded-xl bg-neutral-900 text-lg font-semibold text-white hover:bg-neutral-700 disabled:opacity-40"
                    >
                        Download
                    </button>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function BackgroundButton() {
    const [open, setOpen] = useState(false);
    const background = useCardStore((s) => s.images.background);
    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            side="top"
            className="w-[400px]"
            trigger={
                <button type="button" title="Background image" className={toolButton}>
                    <span className="block size-7 overflow-hidden rounded-md bg-neutral-300">
                        {background && <img src={background} alt="" className="h-full w-full object-cover" />}
                    </span>
                    <span className="text-sm font-medium">Background</span>
                </button>
            }
        >
            <ImagePicker target="background" onDone={() => setOpen(false)} />
        </Popover>
    );
}

function TiltButton() {
    const tilt = useCardStore((s) => s.tilt);
    const setTilt = useCardStore((s) => s.setTilt);
    const dragStart = useRef<typeof tilt | null>(null);
    const temporal = useCardStore.temporal.getState;

    // Live preview while dragging, but a single undo step for the whole drag.
    const startDrag = () => {
        dragStart.current = tilt;
        temporal().pause();
    };
    const endDrag = () => {
        const start = dragStart.current;
        if (!start) return;
        const final = useCardStore.getState().tilt;
        setTilt(start);
        temporal().resume();
        setTilt(final);
        dragStart.current = null;
    };

    return (
        <Popover
            side="top"
            className="w-64"
            trigger={
                <button type="button" title="Tilt color" className={toolButton}>
                    <span className="size-7 rounded-md border border-neutral-300" style={{ backgroundColor: hexToRgba(tilt.color, tilt.opacity) }} />
                    <span className="text-sm font-medium">Tilt</span>
                </button>
            }
        >
            <p className="mb-2 text-sm font-semibold">Tilt color</p>
            <div className="grid grid-cols-5 gap-2">
                {TILT_COLORS.map((color) => (
                    <Swatch key={color} color={color} active={color === tilt.color} onClick={() => setTilt({ color })} />
                ))}
            </div>
            <label className="mt-4 flex flex-col gap-1 text-sm">
                <span className="flex justify-between font-medium">
                    Opacity <span className="text-neutral-500">{Math.round(tilt.opacity * 100)}%</span>
                </span>
                <input
                    type="range"
                    min={TILT_OPACITY.min}
                    max={TILT_OPACITY.max}
                    step={0.05}
                    value={tilt.opacity}
                    onPointerDown={startDrag}
                    onPointerUp={endDrag}
                    onChange={(e) => setTilt({ opacity: Number(e.target.value) })}
                    className="accent-neutral-900"
                />
            </label>
        </Popover>
    );
}

function TileButton() {
    const tileColor = useCardStore((s) => s.tileColor);
    const setTileColor = useCardStore((s) => s.setTileColor);
    return (
        <Popover
            side="top"
            className="w-56"
            trigger={
                <button type="button" title="Fighter background" className={toolButton}>
                    <span className="size-7 rounded-md border border-neutral-300" style={{ backgroundColor: hexToRgba(tileColor, TILE_OPACITY) }} />
                    <span className="text-sm font-medium">Fighters</span>
                </button>
            }
        >
            <p className="mb-2 text-sm font-semibold">Fighter background</p>
            <div className="grid grid-cols-6 gap-2">
                {TILE_COLORS.map((color) => (
                    <Swatch key={color} color={hexToRgba(color, TILE_OPACITY)} active={color === tileColor} onClick={() => setTileColor(color)} />
                ))}
            </div>
        </Popover>
    );
}

function Swatch({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            aria-label={color}
            onClick={onClick}
            className={`aspect-square w-full rounded-lg border border-neutral-300 ${active ? "ring-2 ring-neutral-900 ring-offset-2" : ""}`}
            style={{ backgroundColor: color }}
        />
    );
}
