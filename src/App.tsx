import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { CARD_WIDTH, Card } from "./components/Card";
import { Toolbar } from "./components/Toolbar";
import { hasUnsavedChanges, redo, undo } from "./store";

const TOOLBAR_SPACE = 96;
// Scale against the tallest card (full main card + prelims) so adding fights doesn't rescale the editor.
const MAX_CARD_HEIGHT = 1350;

export function App() {
    const cardRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const scale = useFitScale(stageRef);
    const cardHeight = useHeight(cardRef);
    useUndoShortcuts();
    useLeaveWarning();

    return (
        <div ref={stageRef} className="flex h-full items-center justify-center p-6">
            <div className="flex flex-col gap-3" style={{ width: CARD_WIDTH * scale }}>
                <div className="overflow-hidden rounded-2xl shadow-2xl" style={{ height: cardHeight * scale }}>
                    <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                        <Card ref={cardRef} />
                    </div>
                </div>
                <Toolbar cardRef={cardRef} />
            </div>
        </div>
    );
}

function useFitScale(ref: RefObject<HTMLDivElement | null>) {
    const [scale, setScale] = useState(0.5);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setScale(Math.max(0.2, Math.min(width / CARD_WIDTH, (height - TOOLBAR_SPACE) / MAX_CARD_HEIGHT)));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref]);
    return scale;
}

/** Unscaled layout height of an element (transforms don't affect offsetHeight). */
function useHeight(ref: RefObject<HTMLDivElement | null>) {
    const [height, setHeight] = useState(0);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref]);
    return height;
}

function useLeaveWarning() {
    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges()) e.preventDefault();
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);
}

function useUndoShortcuts() {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey)) return;
            const target = e.target as HTMLElement;
            // Let text fields keep their native undo.
            if (target.closest("input, textarea, select, [contenteditable='true']")) return;
            const key = e.key.toLowerCase();
            if (key === "z") {
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
            } else if (key === "y") {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);
}
