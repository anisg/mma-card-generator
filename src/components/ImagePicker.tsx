import { useEffect, useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { galleryImages, normalize } from "../data";
import { fileToDataUrl, loadCorsImage, pickImageFile } from "../lib";
import { useCardStore, type ImageTarget } from "../store";

const tabClass =
    "rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 data-[state=active]:bg-neutral-900 data-[state=active]:text-white";

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

type ImagePickerProps = { target: ImageTarget; onDone: () => void; uploadOnly?: boolean };

export function ImagePicker({ target, onDone, uploadOnly = false }: ImagePickerProps) {
    const [query, setQuery] = useState("");
    const current = useCardStore((s) => s.images[target]);
    const setImage = useCardStore((s) => s.setImage);

    const results = useMemo(() => {
        const q = normalize(query);
        return q ? galleryImages.filter((img) => img.searchText.includes(q)) : galleryImages;
    }, [query]);

    const apply = (url: string | null) => {
        setImage(target, url);
        onDone();
    };

    return (
        <Tabs.Root defaultValue={uploadOnly ? "upload" : "gallery"} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <Tabs.List className="flex gap-1">
                    {!uploadOnly && (
                        <Tabs.Trigger value="gallery" className={tabClass}>
                            Gallery
                        </Tabs.Trigger>
                    )}
                    <Tabs.Trigger value="upload" className={tabClass}>
                        Upload
                    </Tabs.Trigger>
                </Tabs.List>
                {current && (
                    <button type="button" onClick={() => apply(null)} className="text-sm font-medium text-red-600 hover:underline">
                        Remove
                    </button>
                )}
            </div>

            <Tabs.Content value="gallery" className="flex flex-col gap-3 outline-none">
                <input
                    autoFocus
                    type="search"
                    placeholder="Search a city…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                />
                {results.length ? (
                    <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1">
                        {results.map((img) => (
                            <li key={img.id} className="group relative">
                                <button
                                    type="button"
                                    onClick={() => apply(img.url)}
                                    title={`${img.city} — ${img.alt}`}
                                    className={`block aspect-[4/3] w-full overflow-hidden rounded-lg ring-offset-2 hover:ring-2 hover:ring-neutral-900 ${current === img.url ? "ring-2 ring-neutral-900" : ""}`}
                                >
                                    <img src={img.thumb} alt={img.alt} loading="lazy" className="h-full w-full object-cover" />
                                </button>
                                <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                                    {img.photographer.name} · Unsplash
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="py-6 text-center text-sm text-neutral-500">No image found</p>
                )}
            </Tabs.Content>

            <Tabs.Content value="upload" className="outline-none">
                <UploadZone maxSize={target === "background" ? 1600 : 600} onImage={apply} />
            </Tabs.Content>
        </Tabs.Root>
    );
}

function UploadZone({ maxSize, onImage }: { maxSize: number; onImage: (url: string) => void }) {
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = async (file: File | null | undefined) => {
        if (!file?.type.startsWith("image/")) return setError("This file is not an image.");
        onImage(await fileToDataUrl(file, maxSize));
    };

    const handleLink = async (text: string) => {
        const url = text.trim();
        if (!/^https?:\/\/\S+$/i.test(url)) return setError("Paste an image or an image link.");
        try {
            await loadCorsImage(url);
            onImage(url);
        } catch {
            setError("This link can't be used: the image is missing or its host blocks it.");
        }
    };

    // Mounted only while the Upload tab is open, so pasting in the gallery search is unaffected.
    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
            const text = e.clipboardData?.getData("text/plain");
            if (!file && !text) return;
            e.preventDefault();
            setError(null);
            if (file) void handleFile(file);
            else if (text) void handleLink(text);
        };
        window.addEventListener("paste", onPaste);
        return () => window.removeEventListener("paste", onPaste);
    });

    return (
        <div className="flex flex-col items-center gap-3">
            <button
                type="button"
                onClick={async () => {
                    setError(null);
                    const file = await pickImageFile();
                    if (file) await handleFile(file);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    setError(null);
                    void handleFile(e.dataTransfer.files[0]);
                }}
                className={`flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 text-base font-medium text-neutral-600 transition hover:bg-neutral-200 ${dragging ? "border-neutral-900 bg-neutral-200" : "border-transparent bg-neutral-100"
                    }`}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="9" cy="10" r="2" />
                    <path d="m21 16-5-5-9 9" />
                </svg>
                Upload an image
            </button>
            <p className="text-sm text-neutral-500">or {isMac ? "⌘" : "Ctrl"}+V to paste an image or link</p>
            {error && <p className="text-center text-sm text-red-600">{error}</p>}
        </div>
    );
}
