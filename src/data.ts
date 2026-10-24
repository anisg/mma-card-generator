import fightersData from "../data/fighters.json";
import flagsData from "../data/flags.json";
import citiesData from "../data/cities.json";
import weightClassesData from "../data/weight-classes.json";

export type Flag = (typeof flagsData)[number];
export type WeightClass = (typeof weightClassesData)[number];

export type Fighter = {
  id: string;
  name: string;
  weightClassId: string;
  flagId: string;
  headshot?: string;
  custom?: boolean;
};

export type GalleryImage = {
  id: string;
  thumb: string;
  url: string;
  alt: string;
  city: string;
  searchText: string;
  photographer: { name: string };
};

export const SILHOUETTE = `${import.meta.env.BASE_URL}brand/no-profile-image.avif`;

export const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export const weightClasses = weightClassesData.filter((w) => w.active !== false);
const weightClassById = new Map(weightClassesData.map((w) => [w.id, w]));
const weightClassIdByName = new Map(weightClassesData.map((w) => [w.name, w.id]));

export const getWeightClass = (id: string | null | undefined) => (id ? weightClassById.get(id) : undefined);

export const flags = flagsData;
const flagById = new Map(flagsData.map((f) => [f.id, f]));
export const getFlag = (id: string) => flagById.get(id);
export const flagThumb = (flag: Flag) => flag.image.replace("/w640/", "/w160/");

function flagIdFor(iso3: string, region?: string) {
  const flag = flagsData.find((f) => f.iso3 === iso3 && (region ? f.region === region : !f.region));
  return flag?.id ?? "";
}

// ufc.com sends no CORS headers (needed by the PNG export), so headshots go through the wsrv.nl image proxy.
export const proxiedHeadshot = (url?: string) =>
  url && `https://wsrv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}&w=400&output=webp`;

export const baseFighters: Fighter[] = fightersData.map((f) => ({
  id: f.slug ?? normalize(f.name).replace(/[^a-z0-9]+/g, "-"),
  name: f.name,
  weightClassId: weightClassIdByName.get(f.weightClass) ?? "",
  flagId: flagIdFor(f.nationality, "region" in f ? f.region : undefined),
  headshot: proxiedHeadshot(f.headshot),
}));

export const galleryImages: GalleryImage[] = citiesData.flatMap((city) =>
  city.images.map((img) => ({
    id: `${city.id}-${img.id}`,
    thumb: img.thumb,
    url: img.url,
    alt: img.alt,
    city: city.name,
    searchText: normalize([city.name, "region" in city ? city.region : "", city.countryName].join(" ")),
    photographer: { name: img.photographer.name },
  })),
);

/** Upper-cased last name, skipping generational suffixes. */
export function displayLastName(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts.length > 1 && /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(parts.at(-1)!) ? parts.at(-2)! : parts.at(-1)!;
  return last.toUpperCase();
}

export function heaviestWeightClassId(...ids: (string | undefined)[]) {
  const classes = ids.map(getWeightClass).filter((w): w is WeightClass => Boolean(w));
  if (!classes.length) return null;
  return classes.reduce((a, b) => (b.limitLb > a.limitLb ? b : a)).id;
}
