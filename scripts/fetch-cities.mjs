import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://en.wikipedia.org/w/index.php?title=List_of_UFC_events&action=raw";
const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../data");
const CITIES_FILE = resolve(DATA_DIR, "cities.json");
const INCOMPLETE_FILE = resolve(DATA_DIR, "cities-incomplete.json");
const TOP_COUNT = 50;

const COUNTRIES = {
  "United States": ["USA", "US"],
  Brazil: ["BRA", "BR"],
  Canada: ["CAN", "CA"],
  "United Kingdom": ["GBR", "GB"],
  "United Arab Emirates": ["ARE", "AE"],
  Australia: ["AUS", "AU"],
  China: ["CHN", "CN"],
  Japan: ["JPN", "JP"],
  Mexico: ["MEX", "MX"],
  Germany: ["DEU", "DE"],
  Singapore: ["SGP", "SG"],
  Sweden: ["SWE", "SE"],
  France: ["FRA", "FR"],
  Ireland: ["IRL", "IE"],
  "New Zealand": ["NZL", "NZ"],
  Russia: ["RUS", "RU"],
  Azerbaijan: ["AZE", "AZ"],
  Netherlands: ["NLD", "NL"],
  Poland: ["POL", "PL"],
  "Saudi Arabia": ["SAU", "SA"],
  "South Korea": ["KOR", "KR"],
  Argentina: ["ARG", "AR"],
  Chile: ["CHL", "CL"],
  Croatia: ["HRV", "HR"],
  "Czech Republic": ["CZE", "CZ"],
  Denmark: ["DNK", "DK"],
  Philippines: ["PHL", "PH"],
  "Puerto Rico": ["PRI", "PR"],
  Qatar: ["QAT", "QA"],
  Serbia: ["SRB", "RS"],
  Uruguay: ["URY", "UY"],
};

const UK_NATION_TAGS = { England: "gbeng", Scotland: "gbsct", Wales: "gbwls" };

const iso2ToFlag = (iso2) =>
  String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const subdivisionFlag = (tag) =>
  String.fromCodePoint(0x1f3f4, ...[...tag].map((c) => 0xe0000 + c.charCodeAt(0)), 0xe007f);

const slugify = (text) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const linkText = (text) =>
  text
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .trim();

function parseCities(wikitext) {
  const start = wikitext.search(/^==\s*Event locations\s*==/m);
  const end = wikitext.search(/^==\s*See also\s*==/m);
  if (start === -1 || end === -1) throw new Error("Event locations section not found");

  const cities = [];
  let country = null;

  for (const line of wikitext.slice(start, end).split("\n")) {
    if (line.startsWith("'''")) {
      const name = linkText(line).replace(/\s*\(total:.*$/, "");
      if (!COUNTRIES[name]) throw new Error(`Unknown country: ${name}`);
      country = name;
      continue;
    }
    // "**" lines are venues; only "*" lines are cities. Lines before the first country are intro text.
    if (!country || !line.startsWith("*") || line.startsWith("**")) continue;

    const match = linkText(line.slice(1)).match(/^(.+?)\s*\((\d+)\)\s*$/);
    if (!match) throw new Error(`Unparsable city line: ${line}`);

    const [name, ...regionParts] = match[1].split(/,\s*/);
    const region = regionParts.join(", ") || null;
    const [iso3, iso2] = COUNTRIES[country];
    const ukTag = iso3 === "GBR" ? UK_NATION_TAGS[region] : null;

    cities.push({
      id: slugify(name),
      name,
      ...(region && { region }),
      country: iso3,
      countryName: country,
      flag: ukTag ? subdivisionFlag(ukTag) : iso2ToFlag(iso2),
      eventCount: Number(match[2]),
    });
  }
  return cities;
}

async function readExisting(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return [];
  }
}

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "mma-card-generator/0.1 (cities script)" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const cities = parseCities(await res.text());
  // Homonyms (e.g. Birmingham, Alabama vs. England) get their region appended.
  const nameCounts = new Map();
  for (const { id } of cities) nameCounts.set(id, (nameCounts.get(id) ?? 0) + 1);
  for (const city of cities) {
    if (nameCounts.get(city.id) > 1) {
      city.id = slugify(`${city.name} ${city.region ?? city.countryName}`);
    }
  }
  const ids = cities.map((c) => c.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) throw new Error(`Duplicate city ids: ${dupes.join(", ")}`);

  // Stable sort keeps Wikipedia order for ties.
  const sorted = [...cities].sort((a, b) => b.eventCount - a.eventCount);
  const imagesById = new Map(
    (await readExisting(CITIES_FILE)).filter((c) => c.images).map((c) => [c.id, c.images]),
  );
  const top = sorted
    .slice(0, TOP_COUNT)
    .map((c) => (imagesById.has(c.id) ? { ...c, images: imagesById.get(c.id) } : c));
  const rest = sorted.slice(TOP_COUNT);

  await writeFile(CITIES_FILE, `${JSON.stringify(top, null, 2)}\n`);
  await writeFile(INCOMPLETE_FILE, `${JSON.stringify(rest, null, 2)}\n`);

  const cutoff = top.at(-1).eventCount;
  const tiedOut = rest.filter((c) => c.eventCount === cutoff).length;
  console.log(
    `Cities: ${cities.length} | cities.json: ${top.length} | cities-incomplete.json: ${rest.length}` +
      (tiedOut ? ` | ${tiedOut} cities with ${cutoff} events left out by the cutoff` : ""),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
