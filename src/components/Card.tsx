import { useState, type Ref } from "react";
import { MAX_FIGHTS, useCardStore, type Fight as FightModel, type ImageTarget, type Section } from "../store";
import { Fight, type FightSize } from "./Fight";
import { ImagePicker } from "./ImagePicker";
import { LogoPicker } from "./LogoPicker";
import { AddButton, EditableText, Popover, RemoveButton } from "./ui";

export const CARD_WIDTH = 1120;

export function Card({ ref }: { ref: Ref<HTMLDivElement> }) {
    const background = useCardStore((s) => s.images.background);
    const tilt = useCardStore((s) => s.tilt);
    const mainCard = useCardStore((s) => s.mainCard);
    const prelims = useCardStore((s) => s.prelims);
    const mainCardTime = useCardStore((s) => s.mainCardTime);
    const setText = useCardStore((s) => s.setText);
    const addFight = useCardStore((s) => s.addFight);

    const [mainEvent, coMain, ...undercard] = mainCard;

    return (
        <div
            ref={ref}
            className="relative overflow-hidden bg-white font-display text-white select-none"
            style={{ width: CARD_WIDTH }}
        >
            {background && <img src={background} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" />}
            <div className="absolute inset-0" style={{ backgroundColor: tilt.color, opacity: tilt.opacity }} />

            <div className="relative flex flex-col gap-7 px-5 pt-10 pb-10">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start">
                    <div className="flex justify-start">{mainEvent && <Fight fight={mainEvent} section="mainCard" size="lg" />}</div>
                    <div className="flex flex-col items-center gap-3 px-4">
                        <LogoPicker />
                        <span className="mt-3 text-[40px] leading-none font-bold">MAIN CARD</span>
                        <EditableText value={mainCardTime} onCommit={(v) => setText("mainCardTime", v)} className="text-[30px] leading-none font-medium" />
                    </div>
                    <div className="flex justify-end">{coMain && <Fight fight={coMain} section="mainCard" size="lg" />}</div>
                </div>

                <FightGrid
                    fights={undercard}
                    section="mainCard"
                    size="sm"
                    canAdd={mainCard.length < MAX_FIGHTS.mainCard}
                    onAdd={() => addFight("mainCard")}
                />

                {prelims.length > 0 ? <Prelims fights={prelims} /> : <AddPrelims />}

                <Footer />
            </div>
        </div>
    );
}

type FightGridProps = { fights: FightModel[]; section: Section; size: FightSize; canAdd: boolean; onAdd: () => void };

function FightGrid({ fights, section, size, canAdd, onAdd }: FightGridProps) {
    if (!fights.length && !canAdd) return null;
    return (
        <div className="flex flex-wrap justify-center gap-x-[25px] gap-y-5">
            {fights.map((fight) => (
                <Fight key={fight.id} fight={fight} section={section} size={size} />
            ))}
            {canAdd && <AddButton label="Add fight" onClick={onAdd} className="h-[149px] w-[90px]" />}
        </div>
    );
}

function Prelims({ fights }: { fights: FightModel[] }) {
    const prelimsTime = useCardStore((s) => s.prelimsTime);
    const setText = useCardStore((s) => s.setText);
    const addFight = useCardStore((s) => s.addFight);

    return (
        <>
            <div className="flex items-center justify-center gap-3 bg-black py-3 text-[38px] leading-none font-bold">
                <span>PRELIMS :</span>
                <EditableText value={prelimsTime} onCommit={(v) => setText("prelimsTime", v)} />
            </div>
            <FightGrid
                fights={fights}
                section="prelims"
                size="sm"
                canAdd={fights.length < MAX_FIGHTS.prelims}
                onAdd={() => addFight("prelims")}
            />
        </>
    );
}

function AddPrelims() {
    const addFight = useCardStore((s) => s.addFight);
    return (
        <button
            type="button"
            data-export-ignore=""
            onClick={() => addFight("prelims")}
            className="mx-auto w-4/5 rounded-2xl border-4 border-dashed border-white/60 py-8 text-3xl font-medium text-white/70 transition hover:border-white hover:bg-white/10 hover:text-white"
        >
            + Add prelims
        </button>
    );
}

function Footer() {
    const date = useCardStore((s) => s.date);
    const setText = useCardStore((s) => s.setText);

    return (
        <div className="grid h-[96px] grid-cols-[160px_1fr_160px] items-center border-2 border-white/80 bg-black px-4">
            <FooterImage target="footerLeft" />
            <EditableText value={date} onCommit={(v) => setText("date", v)} className="justify-self-center text-[56px] leading-none font-bold" />
            <FooterImage target="footerRight" />
        </div>
    );
}

function FooterImage({ target }: { target: ImageTarget }) {
    const [open, setOpen] = useState(false);
    const url = useCardStore((s) => s.images[target]);
    const setImage = useCardStore((s) => s.setImage);

    const trigger = url ? (
        <button type="button" aria-label="Replace image" className="flex h-full items-center justify-center transition hover:opacity-75">
            <img src={url} alt="" className="max-h-full max-w-full object-contain" />
        </button>
    ) : (
        <button
            type="button"
            data-export-ignore=""
            aria-label="Add image"
            className="flex size-16 items-center justify-center rounded-xl border-2 border-dashed border-white/70 text-4xl font-light text-white/80 transition hover:border-white hover:bg-white/10 hover:text-white"
        >
            +
        </button>
    );

    return (
        <div className={`flex ${target === "footerLeft" ? "justify-start" : "justify-end"}`}>
            <div className="group relative flex h-[72px] items-center">
                <Popover open={open} onOpenChange={setOpen} side="top" className="w-[360px]" trigger={trigger}>
                    <ImagePicker target={target} uploadOnly onDone={() => setOpen(false)} />
                </Popover>
                {url && (
                    <RemoveButton
                        label="Remove image"
                        onClick={() => setImage(target, null)}
                        className="absolute -top-3 -left-3 opacity-0 transition group-hover:opacity-100"
                    />
                )}
            </div>
        </div>
    );
}
