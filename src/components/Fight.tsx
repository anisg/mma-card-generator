import { useState } from "react";
import { SILHOUETTE, displayLastName, flagThumb, getFlag, getWeightClass, weightClasses, type Fighter } from "../data";
import { TILE_OPACITY, useCardStore, type Corner, type Fight as FightModel, type Section } from "../store";
import { FighterPicker } from "./FighterPicker";
import { Popover, RemoveButton, hexToRgba } from "./ui";

export type FightSize = "lg" | "sm";

const SIZES = {
    lg: { frame: "w-[160px] h-[200px]", gap: "gap-3", name: "text-[32px]", vs: "text-[17px]", label: "text-[14px]", flag: "w-[64px]" },
    sm: { frame: "w-[119px] h-[149px]", gap: "gap-2", name: "text-[24px]", vs: "text-[14px]", label: "text-[12px]", flag: "w-[48px]" },
};

type FightProps = { fight: FightModel; section: Section; size: FightSize };

export function Fight({ fight, section, size }: FightProps) {
    const s = SIZES[size];

    return (
        <div className="flex flex-col items-center">
            <div className={`flex ${s.gap}`}>
                <FighterSlot fight={fight} section={section} corner="red" size={size} />
                <FighterSlot fight={fight} section={section} corner="blue" size={size} />
            </div>
            <div className={`mt-2 flex items-baseline gap-1.5 leading-none font-bold whitespace-nowrap ${s.name}`}>
                <span>{fight.red ? displayLastName(fight.red.name) : "TBD"}</span>
                <span className={`font-medium italic ${s.vs}`}>vs</span>
                <span>{fight.blue ? displayLastName(fight.blue.name) : "TBD"}</span>
            </div>
            <WeightClassLabel fight={fight} section={section} className={s.label} />
        </div>
    );
}

type FighterSlotProps = { fight: FightModel; section: Section; corner: Corner; size: FightSize };

function FighterSlot({ fight, section, corner, size }: FighterSlotProps) {
    const [open, setOpen] = useState(false);
    const fighter = fight[corner];
    const setFighter = useCardStore((s) => s.setFighter);
    const tileColor = useCardStore((s) => s.tileColor);
    const flag = fighter ? getFlag(fighter.flagId) : undefined;
    const s = SIZES[size];

    const pick = (next: Fighter) => {
        setFighter(section, fight.id, corner, next);
        setOpen(false);
    };

    return (
        <div className="group/slot relative">
            <Popover
                open={open}
                onOpenChange={setOpen}
                className="w-[380px]"
                trigger={
                    <button
                        type="button"
                        aria-label={fighter ? `Change ${fighter.name}` : "Pick a fighter"}
                        className={`group/frame relative block overflow-hidden border-2 border-white/90 ${s.frame}`}
                        style={{ backgroundColor: hexToRgba(tileColor, TILE_OPACITY) }}
                    >
                        <span className="absolute inset-0 bg-black/0 transition group-hover/frame:bg-black/25" />
                        <img
                            src={fighter?.headshot ?? SILHOUETTE}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover object-top"
                        />
                        {flag && (
                            <img
                                src={flagThumb(flag)}
                                alt={flag.name}
                                className={`absolute bottom-0 ${corner === "red" ? "left-0" : "right-0"} ${s.flag}`}
                            />
                        )}
                    </button>
                }
            >
                <FighterPicker onPick={pick} />
            </Popover>
            {fighter && (
                <RemoveButton
                    label={`Remove ${fighter.name}`}
                    onClick={() => setFighter(section, fight.id, corner, null)}
                    className="absolute -top-2.5 -left-2.5 z-10 opacity-0 transition group-hover/slot:opacity-100"
                />
            )}
        </div>
    );
}

function WeightClassLabel({ fight, section, className }: { fight: FightModel; section: Section; className: string }) {
    const [open, setOpen] = useState(false);
    const setWeightClass = useCardStore((s) => s.setWeightClass);
    const current = getWeightClass(fight.weightClassId);

    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            className="w-60 p-1.5"
            trigger={
                <button
                    type="button"
                    {...(current ? {} : { "data-export-ignore": "" })}
                    className={`mt-1 rounded px-1 font-medium tracking-wide uppercase italic hover:bg-white/15 ${current ? "" : "text-white/50"} ${className}`}
                >
                    {current ? `${current.name} bout` : "Select weight class"}
                </button>
            }
        >
            <ul className="max-h-80 overflow-y-auto">
                {weightClasses.map((w) => (
                    <li key={w.id}>
                        <button
                            type="button"
                            onClick={() => {
                                setWeightClass(section, fight.id, w.id);
                                setOpen(false);
                            }}
                            className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 ${w.id === current?.id ? "font-semibold" : ""}`}
                        >
                            {w.name}
                        </button>
                    </li>
                ))}
            </ul>
        </Popover>
    );
}
