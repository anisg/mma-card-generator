import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../data");
const FIGHTERS_FILE = resolve(DATA_DIR, "fighters.json");
const OVERRIDES_FILE = resolve(DATA_DIR, "ufc-slug-overrides.json");
const CONCURRENCY = 4;
const DELAY_MS = 150;
const FORCE = process.argv.includes("--force");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const slugify = (text) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const nameTokens = (name) => slugify(name.replace(/-/g, "")).split("-");

function slugCandidates(name) {
  const withoutSuffix = name.replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, "");
  const parts = withoutSuffix.split(" ");
  const reversed = [parts.at(-1), ...parts.slice(0, -1)].join(" ");
  const strict = [name, withoutSuffix, reversed].map(slugify);
  const loose = [
    ...[withoutSuffix, reversed].map((n) => slugify(n.replace(/-/g, ""))),
    slugify(`${parts[0]} ${parts.at(-1)}`),
  ];
  return [
    ...new Set(strict),
    ...[...new Set(loose)].filter((s) => !strict.includes(s)).map((slug) => ({ slug, loose: true })),
  ].map((c) => (typeof c === "string" ? { slug: c, loose: false } : c));
}

// Slugs from ufc.com search whose tokens all belong to the fighter's name.
async function searchSlugs(name) {
  const tokens = new Set(nameTokens(name));
  const slugs = new Set();
  for (const query of [name, name.split(" ").at(-1)]) {
    const res = await fetch(`https://www.ufc.com/athletes/all?search=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (mma-card-generator)" },
    });
    await sleep(DELAY_MS);
    if (!res.ok) continue;
    for (const [, slug] of (await res.text()).matchAll(/href="\/athlete\/([^"]+)"/g)) {
      const slugTokens = slug.replace(/-\d+$/, "").split("-");
      if (slugTokens.length >= 2 && slugTokens.every((t) => tokens.has(t))) slugs.add(slug);
    }
    if (slugs.size) break;
  }
  return [...slugs].map((slug) => ({ slug, loose: true }));
}

async function fetchProfile(slug) {
  const res = await fetch(`https://www.ufc.com/athlete/${slug}`, {
    headers: { "User-Agent": "Mozilla/5.0 (mma-card-generator)" },
  });
  if (!res.ok) return null;
  const html = await res.text();
  // Unknown slugs return a 200 page without the profile header.
  if (!html.includes("hero-profile__name")) return null;
  const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  return {
    image: image?.replace(/^https:\/\/ufc\.com\//, "https://www.ufc.com/") ?? null,
    active: /hero-profile__tag">\s*(Active|Actif)\s*</.test(html),
  };
}

async function tryCandidates(candidates) {
  for (const { slug, loose } of candidates) {
    const profile = await fetchProfile(slug);
    await sleep(DELAY_MS);
    // Loose matches could be a retired homonym, so only accept active profiles.
    if (profile && (!loose || profile.active)) return { slug, ...profile };
  }
  return null;
}

async function resolveFighter(fighter, overrides) {
  if (overrides[fighter.name]) return tryCandidates([{ slug: overrides[fighter.name], loose: false }]);
  return (
    (await tryCandidates(slugCandidates(fighter.name))) ??
    (await tryCandidates(await searchSlugs(fighter.name)))
  );
}

async function readOverrides() {
  try {
    return JSON.parse(await readFile(OVERRIDES_FILE, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function main() {
  const fighters = JSON.parse(await readFile(FIGHTERS_FILE, "utf8"));
  const overrides = await readOverrides();
  const todo = fighters.filter((f) => FORCE || !f.slug);
  const report = { found: 0, silhouette: [], notFound: [], inactive: [] };

  let index = 0;
  const worker = async () => {
    while (index < todo.length) {
      const fighter = todo[index++];
      const result = await resolveFighter(fighter, overrides);
      if (!result) {
        report.notFound.push(fighter.name);
        continue;
      }
      fighter.slug = result.slug;
      if (!result.image || result.image.includes("silhouette")) {
        delete fighter.headshot;
        report.silhouette.push(fighter.name);
      } else {
        fighter.headshot = result.image;
        report.found++;
      }
      if (!result.active && fighter.debuted !== false) report.inactive.push(`${fighter.name} (${result.slug})`);
      process.stdout.write(`\r${index}/${todo.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  await writeFile(FIGHTERS_FILE, `${JSON.stringify(fighters, null, 2)}\n`);

  console.log(`\nProcessed ${todo.length}, headshots: ${report.found}`);
  console.log(`Silhouette only (${report.silhouette.length}):`, report.silhouette);
  console.log(`Not found (${report.notFound.length}) — add to ufc-slug-overrides.json:`, report.notFound);
  console.log(`Not marked active, check for homonyms (${report.inactive.length}):`, report.inactive);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
