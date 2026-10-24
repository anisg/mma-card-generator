import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://en.wikipedia.org/w/index.php?title=List_of_current_UFC_fighters&action=raw";
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), "../data/fighters.json");

const WEIGHT_CLASSES = {
  heavyweight: "Heavyweight",
  "light heavyweight": "Light Heavyweight",
  middleweight: "Middleweight",
  welterweight: "Welterweight",
  lightweight: "Lightweight",
  featherweight: "Featherweight",
  bantamweight: "Bantamweight",
  flyweight: "Flyweight",
  "women's bantamweight": "Women's Bantamweight",
  "women's flyweight": "Women's Flyweight",
  "women's strawweight": "Women's Strawweight",
};

// Wikipedia mixes IOC/FIFA codes with ISO 3166-1 alpha-3.
const CODE_ALIASES = {
  CHI: "CHL",
  CRO: "HRV",
  DEN: "DNK",
  DRC: "COD",
  GER: "DEU",
  INA: "IDN",
  IRE: "IRL",
  LIT: "LTU",
  NED: "NLD",
  NGR: "NGA",
  POR: "PRT",
  SUI: "CHE",
  UAE: "ARE",
};

const UK_REGIONS = {
  ENG: { name: "England", tag: "gbeng" },
  SCO: { name: "Scotland", tag: "gbsct" },
  WAL: { name: "Wales", tag: "gbwls" },
  NIR: { name: "Northern Ireland", tag: null },
};

const ISO3_TO_ISO2 = {
  ABW: "AW",
  AGO: "AO",
  ALB: "AL",
  ARE: "AE",
  ARG: "AR",
  ARM: "AM",
  AUS: "AU",
  AUT: "AT",
  AZE: "AZ",
  BEL: "BE",
  BHR: "BH",
  BRA: "BR",
  CAN: "CA",
  CHE: "CH",
  CHL: "CL",
  CHN: "CN",
  CMR: "CM",
  COD: "CD",
  COL: "CO",
  CUB: "CU",
  CZE: "CZ",
  DEU: "DE",
  DNK: "DK",
  DOM: "DO",
  ECU: "EC",
  ESP: "ES",
  FIN: "FI",
  FRA: "FR",
  GBR: "GB",
  GEO: "GE",
  HRV: "HR",
  HUN: "HU",
  IDN: "ID",
  IND: "IN",
  IRL: "IE",
  IRN: "IR",
  IRQ: "IQ",
  ISL: "IS",
  ITA: "IT",
  JAM: "JM",
  JPN: "JP",
  KAZ: "KZ",
  KGZ: "KG",
  KOR: "KR",
  LTU: "LT",
  MAR: "MA",
  MDA: "MD",
  MEX: "MX",
  MMR: "MM",
  MNE: "ME",
  MNG: "MN",
  NGA: "NG",
  NLD: "NL",
  NOR: "NO",
  NZL: "NZ",
  PAN: "PA",
  PER: "PE",
  POL: "PL",
  PRT: "PT",
  PSE: "PS",
  ROU: "RO",
  RUS: "RU",
  SEN: "SN",
  SRB: "RS",
  SVK: "SK",
  SWE: "SE",
  THA: "TH",
  TJK: "TJ",
  TUR: "TR",
  UGA: "UG",
  UKR: "UA",
  USA: "US",
  UZB: "UZ",
  VEN: "VE",
  ZAF: "ZA",
};

const iso2ToFlag = (iso2) => String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const subdivisionFlag = (tag) => String.fromCodePoint(0x1f3f4, ...[...tag].map((c) => 0xe0000 + c.charCodeAt(0)), 0xe007f);

function resolveNationality(rawCode) {
  const region = UK_REGIONS[rawCode];
  const iso3 = region ? "GBR" : (CODE_ALIASES[rawCode] ?? rawCode);
  const iso2 = ISO3_TO_ISO2[iso3];
  if (!iso2) throw new Error(`Unknown country code: ${rawCode}`);
  return {
    nationality: iso3,
    ...(region && { region: region.name }),
    flag: region?.tag ? subdivisionFlag(region.tag) : iso2ToFlag(iso2),
  };
}

function normalizeWeightClass(label) {
  const key = label
    .replace(/\(.*\)/, "")
    .trim()
    .toLowerCase()
    .replace(/s$/, "");
  const weightClass = WEIGHT_CLASSES[key];
  if (!weightClass) throw new Error(`Unknown weight class: ${label}`);
  return weightClass;
}

function stripMarkup(cell) {
  return cell
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<[^>]+>/g, "");
}

function parseName(cell) {
  let text = stripMarkup(cell);

  text = text.replace(/\{\{\s*sortname\s*\|([^}]*)\}\}/gi, (_, args) => {
    const positional = args.split("|").filter((a) => !a.includes("="));
    return `${positional[0] ?? ""} ${positional[1] ?? ""}`;
  });
  text = text.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");
  text = text.replace(/\{\{[^}]*\}\}/g, "");
  text = text.replace(/'{2,}/g, "").replace(/\*/g, "");
  // Champion markers, and stray leading pipes from "||" typos in the source.
  text = text.replace(/\((?:c|ic)\)/gi, "").replace(/^\s*\|+/, "");

  return text.replace(/\s+/g, " ").trim();
}

function parseFlag(cell) {
  const match = cell.match(/flag\|icon\|([A-Za-z]+)/) ?? cell.match(/flagicon\|([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : null;
}

// Returns each table row as an array of cell strings.
function parseTableRows(tableText) {
  return tableText
    .split(/\n\|-[^\n]*/)
    .slice(1)
    .map((row) => {
      const cells = [];
      for (const line of row.split("\n")) {
        if (line.startsWith("|") && !line.startsWith("|}")) cells.push(line.slice(1));
        else if (cells.length && !line.startsWith("!")) cells[cells.length - 1] += `\n${line}`;
      }
      return cells;
    })
    .filter((cells) => cells.length > 0);
}

function extractTable(text) {
  const start = text.indexOf("{|");
  const end = text.indexOf("\n|}", start);
  return start === -1 || end === -1 ? "" : text.slice(start, end);
}

function sectionBetween(wikitext, startHeading, endHeading) {
  const start = wikitext.search(startHeading);
  const end = wikitext.search(endHeading);
  if (start === -1 || end === -1) throw new Error(`Section not found: ${startHeading}`);
  return wikitext.slice(start, end);
}

function buildFighter({ name, weightClass, flagCode, debuted }) {
  if (!name) throw new Error(`Empty name (${weightClass}, ${flagCode})`);
  if (!flagCode) throw new Error(`Missing flag for ${name}`);
  return { name, weightClass, ...resolveNationality(flagCode), ...(!debuted && { debuted }) };
}

function parseDebuted(wikitext) {
  const section = sectionBetween(wikitext, /^==\s*Debuted fighters\s*==/m, /^==\s*See also\s*==/m);
  const fighters = [];
  const parts = section.split(/^===([^=]+)===.*$/m);

  for (let i = 1; i < parts.length; i += 2) {
    const weightClass = normalizeWeightClass(parts[i]);
    for (const [flagCell, nameCell] of parseTableRows(extractTable(parts[i + 1]))) {
      fighters.push(
        buildFighter({
          name: parseName(nameCell),
          weightClass,
          flagCode: parseFlag(flagCell),
          debuted: true,
        }),
      );
    }
  }
  return fighters;
}

function parseSignings(wikitext) {
  const section = sectionBetween(wikitext, /^==\s*Recent signings\s*==/m, /^==\s*Suspended fighters\s*==/m);
  return parseTableRows(extractTable(section)).map(([, flagCell, nameCell, , divisionCell]) =>
    buildFighter({
      name: parseName(nameCell),
      weightClass: normalizeWeightClass(stripMarkup(divisionCell)),
      flagCode: parseFlag(flagCell),
      debuted: false,
    }),
  );
}

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "mma-card-generator/0.1 (fighter roster script)" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const wikitext = await res.text();

  const debuted = parseDebuted(wikitext);
  const signings = parseSignings(wikitext);
  const debutedNames = new Set(debuted.map((f) => f.name));
  const fighters = [...debuted, ...signings.filter((f) => !debutedNames.has(f.name))];

  // Keep data added by fetch-headshots.mjs.
  const previous = await readFile(OUTPUT, "utf8").then(JSON.parse, () => []);
  const enrichment = new Map(previous.map(({ name, slug, headshot }) => [name, { slug, headshot }]));
  for (const fighter of fighters) {
    const { slug, headshot } = enrichment.get(fighter.name) ?? {};
    if (slug) fighter.slug = slug;
    if (headshot) fighter.headshot = headshot;
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(fighters, null, 2)}\n`);

  console.log(`Debuted: ${debuted.length}, signings: ${signings.length}, total written: ${fighters.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
