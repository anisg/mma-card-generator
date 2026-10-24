import { useMemo, useState } from "react";
import { SILHOUETTE, baseFighters, flagThumb, flags, getFlag, normalize, weightClasses, type Fighter } from "../data";
import { fileToDataUrl, pickImageFile } from "../lib";
import { useCardStore } from "../store";

const MAX_RESULTS = 60;

export function FighterPicker({ onPick }: { onPick: (fighter: Fighter) => void }) {
    const [query, setQuery] = useState("");
    const [adding, setAdding] = useState(false);
    const customFighters = useCardStore((s) => s.customFighters);
    const addCustomFighter = useCardStore((s) => s.addCustomFighter);

    const results = useMemo(() => {
        const q = normalize(query);
        const all = [...customFighters, ...baseFighters];
        return (q ? all.filter((f) => normalize(f.name).includes(q)) : all).slice(0, MAX_RESULTS);
    }, [query, customFighters]);

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
