import { create } from "zustand";
import { shallow } from "zustand/shallow";
import { temporal } from "zundo";
import { heaviestWeightClassId, type Fighter } from "./data";

export type Corner = "red" | "blue";
export type Section = "mainCard" | "prelims";
export type ImageTarget = "background" | "footerLeft" | "footerRight";
export type EventType = "fight-night" | "numbered";
export type TextKey = "mainCardTime" | "prelimsTime" | "date";

export type Fight = {
  id: string;
  red: Fighter | null;
  blue: Fighter | null;
  weightClassId: string | null;
};

export const MAX_FIGHTS: Record<Section, number> = { mainCard: 6, prelims: 8 };

export const TILT_COLORS = ["#000000", "#7f1d1d", "#b91c1c", "#c2410c", "#a16207", "#15803d", "#0f766e", "#1d4ed8", "#6d28d9", "#be185d"];
export const TILT_OPACITY = { min: 0.4, max: 0.9 };

// Fighter tiles always use 40% opacity.
export const TILE_COLORS = ["#5b8a8f", "#8f6b6b", "#5f6f52", "#4b5563", "#9a7b4f", "#6b5b95"];
export const TILE_OPACITY = 0.4;

type CardData = {
  eventType: EventType;
  eventNumber: string;
  mainCardTime: string;
  prelimsTime: string;
  date: string;
  mainCard: Fight[];
  prelims: Fight[];
  images: Record<ImageTarget, string | null>;
  tilt: { color: string; opacity: number };
  tileColor: string;
  customFighters: Fighter[];
};

type CardActions = {
  setFighter: (section: Section, fightId: string, corner: Corner, fighter: Fighter | null) => void;
  setWeightClass: (section: Section, fightId: string, weightClassId: string) => void;
  addFight: (section: Section) => void;
  setText: (key: TextKey, value: string) => void;
  setEvent: (eventType: EventType, eventNumber?: string) => void;
  setImage: (target: ImageTarget, url: string | null) => void;
  setTilt: (tilt: Partial<CardData["tilt"]>) => void;
  setTileColor: (color: string) => void;
  addCustomFighter: (fighter: Fighter) => void;
};

export type CardState = CardData & CardActions;

const newFight = (): Fight => ({ id: crypto.randomUUID(), red: null, blue: null, weightClassId: null });

const initialData: CardData = {
  eventType: "fight-night",
  eventNumber: "332",
  mainCardTime: "21H",
  prelimsTime: "18H",
  date: "JUNE 20",
  mainCard: Array.from({ length: 4 }, newFight),
  prelims: [],
  images: { background: null, footerLeft: null, footerRight: null },
  tilt: { color: TILT_COLORS[0], opacity: 0.5 },
  tileColor: TILE_COLORS[0],
  customFighters: [],
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const pickData = (state: CardState): CardData => {
  const { eventType, eventNumber, mainCardTime, prelimsTime, date, mainCard, prelims, images, tilt, tileColor, customFighters } = state;
  return { eventType, eventNumber, mainCardTime, prelimsTime, date, mainCard, prelims, images, tilt, tileColor, customFighters };
};

export const useCardStore = create<CardState>()(
  temporal(
    (set) => {
      const updateFight = (section: Section, fightId: string, update: (fight: Fight) => Fight) => set((state) => ({ [section]: state[section].map((f) => (f.id === fightId ? update(f) : f)) }));

      return {
        ...initialData,
        setFighter: (section, fightId, corner, fighter) =>
          updateFight(section, fightId, (fight) => {
            const next = { ...fight, [corner]: fighter };
            const autoClass = heaviestWeightClassId(next.red?.weightClassId, next.blue?.weightClassId);
            return { ...next, weightClassId: fighter ? autoClass : (fight.weightClassId ?? autoClass) };
          }),
        setWeightClass: (section, fightId, weightClassId) => updateFight(section, fightId, (fight) => ({ ...fight, weightClassId })),
        addFight: (section) => set((state) => (state[section].length >= MAX_FIGHTS[section] ? {} : { [section]: [...state[section], newFight()] })),
        setText: (key, value) => set({ [key]: value }),
        setEvent: (eventType, eventNumber) => set((state) => ({ eventType, eventNumber: eventNumber ?? state.eventNumber })),
        setImage: (target, url) => set((state) => ({ images: { ...state.images, [target]: url } })),
        setTilt: (tilt) =>
          set((state) => {
            const next = { ...state.tilt, ...tilt };
            return { tilt: { ...next, opacity: clamp(next.opacity, TILT_OPACITY.min, TILT_OPACITY.max) } };
          }),
        setTileColor: (tileColor) => set({ tileColor }),
        addCustomFighter: (fighter) => set((state) => ({ customFighters: [...state.customFighters, fighter] })),
      };
    },
    { partialize: pickData, limit: 100, equality: shallow },
  ),
);

export const undo = () => useCardStore.temporal.getState().undo();
export const redo = () => useCardStore.temporal.getState().redo();
export const hasUnsavedChanges = () => useCardStore.temporal.getState().pastStates.length > 0;
