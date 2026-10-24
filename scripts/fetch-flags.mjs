import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../data");
const OUTPUT = resolve(DATA_DIR, "flags.json");
const FLAGCDN_CODES_URL = "https://flagcdn.com/en/codes.json";
const ISO_URL =
  "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json";
const imageUrl = (code) => `https://flagcdn.com/w640/${code}.png`;

const UK_NATIONS = {
  "gb-eng": { region: "England", tag: "gbeng" },
  "gb-sct": { region: "Scotland", tag: "gbsct" },
  "gb-wls": { region: "Wales", tag: "gbwls" },
  "gb-nir": { region: "Northern Ireland", tag: null },
};

// Flags flagcdn has but the ISO list lacks (Kosovo has no official alpha-3).
const EXTRA = { xk: { iso3: "XKX", continent: "Europe" } };
// The ISO dataset leaves Taiwan's region blank.
const CONTINENT_FALLBACK = { tw: "Asia" };

const iso2ToFlag = (iso2) =>
  String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const subdivisionFlag = (tag) =>
  String.fromCodePoint(0x1f3f4, ...[...tag].map((c) => 0xe0000 + c.charCodeAt(0)), 0xe007f);

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
  return res.json();
}

function buildFlags(codes, isoList) {
  const isoByAlpha2 = new Map(isoList.map((c) => [c["alpha-2"].toLowerCase(), c]));
  const uk = isoByAlpha2.get("gb");
  const flags = [];

  for (const [code, name] of Object.entries(codes)) {
    const nation = UK_NATIONS[code];
    if (nation) {
      flags.push({
        id: code,
        iso2: "GB",
        iso3: uk["alpha-3"],
        region: nation.region,
        name,
        emoji: nation.tag ? subdivisionFlag(nation.tag) : iso2ToFlag("gb"),
        continent: uk.region,
        image: imageUrl(code),
      });
      continue;
    }

    const iso = isoByAlpha2.get(code);
    const extra = EXTRA[code];
    // Skips US states and supranational flags (EU, UN).
    if (!iso && !extra) continue;
    flags.push({
      id: code,
      iso2: code.toUpperCase(),
      iso3: iso?.["alpha-3"] ?? extra.iso3,
      name,
      emoji: iso2ToFlag(code),
      continent: iso?.region || extra?.continent || CONTINENT_FALLBACK[code] || null,
      image: imageUrl(code),
    });
  }
  return flags.sort((a, b) => a.name.localeCompare(b.name));
}

// Every nationality/region used in our data must resolve to a flag.
async function checkCoverage(flags) {
  const keys = new Set(flags.map((f) => `${f.iso3}|${f.region ?? ""}`));
  const read = async (file) => JSON.parse(await readFile(resolve(DATA_DIR, file), "utf8"));
  const used = [
    ...(await read("fighters.json")).map((f) => `${f.nationality}|${f.region ?? ""}`),
    ...(await read("cities.json")).map((c) => `${c.country}|${c.countryName === "United Kingdom" ? c.region : ""}`),
    ...(await read("cities-incomplete.json")).map((c) => `${c.country}|${c.countryName === "United Kingdom" ? c.region : ""}`),
  ];
  return [...new Set(used)].filter((key) => !keys.has(key));
}

async function main() {
  const [codes, isoList] = await Promise.all([getJson(FLAGCDN_CODES_URL), getJson(ISO_URL)]);
  const flags = buildFlags(codes, isoList);
  await writeFile(OUTPUT, `${JSON.stringify(flags, null, 2)}\n`);

  const missing = await checkCoverage(flags);
  console.log(`Flags: ${flags.length}. Missing for our data: ${missing.length ? missing.join(", ") : "none"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
