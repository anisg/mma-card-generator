import { useMemo, useState, type ReactNode } from "react";
import { SILHOUETTE, baseFighters, flagThumb, flags, getFlag, getWeightClass, normalize, weightClasses, type Fighter } from "../data";
import { fileToDataUrl, pickImageFile } from "../lib";
import { useCardStore } from "../store";
import { Popover } from "./ui";

const MAX_RESULTS = 60;

export function FighterPicker({ onPick }: { onPick: (fighter: Fighter) => void }) {
    const [query, setQuery] = useState("");
    const [weightClassId, setWeightClassId] = useState<string | null>(null);
    const [flagId, setFlagId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const customFighters = useCardStore((s) => s.customFighters);
    const addCustomFighter = useCardStore((s) => s.addCustomFighter);

    const allFighters = useMemo(() => [...customFighters, ...baseFighters], [customFighters]);

    const results = useMemo(() => {
        const q = normalize(query);
        return allFighters
            .filter(
                (f) =>
                    (!q || normalize(f.name).includes(q)) &&
                    (!weightClassId || f.weightClassId === weightClassId) &&
                    (!flagId || f.flagId === flagId),
            )
            .slice(0, MAX_RESULTS);
    }, [query, weightClassId, flagId, allFighters]);

    if (adding) {
        return (
            <AddFighterForm
                initialName={query.trim()}
                onCancel={() => setAdding(false)}
                onSubmit={(fighter) => {
                    addCustomFighter(fighter);
                    onPick(fighter);
                }}
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <input
                autoFocus
                type="search"
                placeholder="Search a fighter…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <div className="flex gap-2">
                <WeightClassFilter value={weightClassId} onChange={setWeightClassId} />
                <CountryFilter value={flagId} onChange={setFlagId} fighters={allFighters} />
            </div>
            {results.length > 0 ? (
                <ul className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto pr-1">
                    {results.map((f) => (
                        <li key={f.id}>
                            <FighterCard fighter={f} onClick={() => onPick(f)} />
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-col items-center gap-3 py-6 text-sm">
                    <p className="text-neutral-600">No fighter found</p>
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="rounded-xl border-2 border-neutral-900 px-4 py-1.5 font-medium hover:bg-neutral-900 hover:text-white"
                    >
                        + Add fighter
                    </button>
                </div>
            )}
        </div>
    );
}

function FighterCard({ fighter, onClick }: { fighter: Fighter; onClick: () => void }) {
    const flag = getFlag(fighter.flagId);
    return (
        <button type="button" onClick={onClick} className="group flex w-full flex-col items-center gap-1 rounded-xl p-1 hover:bg-neutral-100">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-neutral-200">
                <img src={fighter.headshot ?? SILHOUETTE} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                {flag && <img src={flagThumb(flag)} alt={flag.name} className="absolute bottom-1 left-1 w-6 border border-white" />}
            </div>
            <span className="line-clamp-2 text-center text-xs leading-tight font-medium">{fighter.name}</span>
        </button>
    );
}

const sortedFlags = [...flags].sort((a, b) => a.name.localeCompare(b.name));

type FilterChipProps = {
    label: string;
    activeLabel?: string;
    onClear: () => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
};

function FilterChip({ label, activeLabel, onClear, open, onOpenChange, children }: FilterChipProps) {
    const active = Boolean(activeLabel);
    return (
        <div
            className={`flex h-8 items-center rounded-md text-xs font-medium transition ${active ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
        >
            <Popover
                open={open}
                onOpenChange={onOpenChange}
                align="start"
                className="w-60 p-1.5"
                trigger={
                    <button type="button" className="flex h-full max-w-40 items-center gap-1 px-2.5">
                        <span className="truncate">{activeLabel ?? label}</span>
                        {!active && <span aria-hidden="true">▾</span>}
                    </button>
                }
            >
                {children}
            </Popover>
            {active && (
                <button
                    type="button"
                    aria-label={`Clear ${label}`}
                    onClick={onClear}
                    className="flex h-full items-center rounded-r-md px-2 text-sm leading-none hover:bg-blue-700"
                >
                    ×
                </button>
            )}
        </div>
    );
}

function WeightClassFilter({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <FilterChip label="Weight class" activeLabel={getWeightClass(value)?.name} onClear={() => onChange(null)} open={open} onOpenChange={setOpen}>
            <ul className="max-h-72 overflow-y-auto">
                {weightClasses.map((w) => (
                    <li key={w.id}>
                        <button
                            type="button"
                            onClick={() => {
                                onChange(w.id);
                                setOpen(false);
                            }}
                            className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 ${w.id === value ? "font-semibold" : ""}`}
                        >
                            {w.name}
                        </button>
                    </li>
                ))}
            </ul>
        </FilterChip>
    );
}

type CountryFilterProps = { value: string | null; onChange: (id: string | null) => void; fighters: Fighter[] };

function CountryFilter({ value, onChange, fighters }: CountryFilterProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

    // Only countries that have at least one fighter.
    const countries = useMemo(() => {
        const used = new Set(fighters.map((f) => f.flagId));
        return sortedFlags.filter((f) => used.has(f.id));
    }, [fighters]);

    const q = normalize(query);
    const results = q ? countries.filter((f) => normalize(f.name).includes(q)) : countries;
    const selected = value ? getFlag(value) : undefined;

    return (
        <FilterChip
            label="Country"
            activeLabel={selected ? `${selected.emoji} ${selected.name}` : undefined}
            onClear={() => onChange(null)}
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setQuery("");
            }}
        >
            <input
                autoFocus
                type="search"
                placeholder="Search a country…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mb-1 w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
            />
            <ul className="max-h-64 overflow-y-auto">
                {results.map((f) => (
                    <li key={f.id}>
                        <button
                            type="button"
                            onClick={() => {
                                onChange(f.id);
                                setOpen(false);
                                setQuery("");
                            }}
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 ${f.id === value ? "font-semibold" : ""}`}
                        >
                            <img src={flagThumb(f)} alt="" className="w-5" />
                            {f.name}
                        </button>
                    </li>
                ))}
                {!results.length && <li className="px-3 py-2 text-sm text-neutral-500">No country found</li>}
            </ul>
        </FilterChip>
    );
}

type AddFighterFormProps = {
    initialName: string;
    onSubmit: (fighter: Fighter) => void;
    onCancel: () => void;
};

function AddFighterForm({ initialName, onSubmit, onCancel }: AddFighterFormProps) {
    const [name, setName] = useState(initialName);
    const [weightClassId, setWeightClassId] = useState(weightClasses[0].id);
    const [flagId, setFlagId] = useState("");
    const [photo, setPhoto] = useState<string | undefined>();

    const uploadPhoto = async () => {
        const file = await pickImageFile();
        if (file) setPhoto(await fileToDataUrl(file, 480));
    };

    const canSubmit = name.trim() && flagId;

    return (
        <form
            className="flex flex-col gap-3 text-sm"
            onSubmit={(e) => {
                e.preventDefault();
                if (!canSubmit) return;
                onSubmit({ id: `custom-${crypto.randomUUID()}`, name: name.trim(), weightClassId, flagId, headshot: photo, custom: true });
            }}
        >
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={uploadPhoto}
                    title="Upload photo"
                    className="relative h-[100px] w-[80px] shrink-0 overflow-hidden rounded-lg border-2 border-neutral-300 bg-neutral-200 hover:border-neutral-900"
                >
                    <img src={photo ?? SILHOUETTE} alt="" className="h-full w-full object-cover object-top" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-[10px] text-white">Upload</span>
                </button>
                <input
                    autoFocus
                    required
                    value={name}
                    placeholder="Fighter name"
                    onChange={(e) => setName(e.target.value)}
                    className="min-w-0 flex-1 border-b-2 border-neutral-300 py-1 font-display text-xl font-bold uppercase outline-none focus:border-neutral-900"
                />
            </div>
            <label className="flex flex-col gap-1">
                <span className="font-medium">Weight class</span>
                <select value={weightClassId} onChange={(e) => setWeightClassId(e.target.value)} className="rounded-xl border border-neutral-300 px-3 py-2">
                    {weightClasses.map((w) => (
                        <option key={w.id} value={w.id}>
                            {w.name}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex flex-col gap-1">
                <span className="font-medium">Nationality</span>
                <select required value={flagId} onChange={(e) => setFlagId(e.target.value)} className="rounded-xl border border-neutral-300 px-3 py-2">
                    <option value="" disabled>
                        Select a country
                    </option>
                    {sortedFlags.map((f) => (
                        <option key={f.id} value={f.id}>
                            {f.emoji} {f.name}
                        </option>
                    ))}
                </select>
            </label>
            <div className="flex gap-2 pt-1">
                <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 font-medium text-neutral-600 hover:bg-neutral-100">
                    Back
                </button>
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex-1 rounded-xl bg-neutral-900 py-2 font-medium text-white disabled:opacity-40"
                >
                    Add fighter
                </button>
            </div>
        </form>
    );
}
