import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CITIES_FILE = resolve(ROOT, "data/cities.json");
const IMAGES_PER_CITY = 3;
// Top relevant results re-ranked by likes; the search API can't sort by popularity, and a bigger pool drifts off-topic.
const POOL_SIZE = 10;
const UTM = "utm_source=mma-card-generator&utm_medium=referral";
const FORCE = process.argv.includes("--force");

process.loadEnvFile(resolve(ROOT, ".env"));
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!ACCESS_KEY) throw new Error("UNSPLASH_ACCESS_KEY missing from .env");

const withUtm = (url) => `${url}${url.includes("?") ? "&" : "?"}${UTM}`;

const toImage = (photo) => ({
  id: photo.id,
  url: photo.urls.regular,
  thumb: photo.urls.small,
  raw: photo.urls.raw,
  width: photo.width,
  height: photo.height,
  color: photo.color,
  alt: photo.alt_description,
  likes: photo.likes,
  photographer: {
    name: photo.user.name,
    username: photo.user.username,
    url: withUtm(photo.user.links.html),
  },
  unsplashUrl: withUtm(photo.links.html),
  downloadLocation: photo.links.download_location,
});

async function searchPhotos(query) {
  const params = new URLSearchParams({
    query,
    per_page: String(POOL_SIZE),
    orientation: "landscape",
    content_filter: "high",
  });
  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}`, "Accept-Version": "v1" },
  });
  const remaining = Number(res.headers.get("x-ratelimit-remaining"));
  if (res.status === 403 || res.status === 429) return { rateLimited: true, remaining: 0 };
  if (!res.ok) throw new Error(`Unsplash ${res.status} for "${query}": ${await res.text()}`);

  const { results } = await res.json();
  const images = [...results]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, IMAGES_PER_CITY)
    .map(toImage);
  return { images, remaining };
}

async function searchCity(city) {
  const area = city.region ?? city.countryName;
  const result = await searchPhotos(`${city.name} ${area}`);
  if (result.rateLimited || result.images.length || result.remaining === 0) return result;
  // Small towns (e.g. Uncasville) have no photos; fall back to the state/country.
  return searchPhotos(area);
}

async function main() {
  const cities = JSON.parse(await readFile(CITIES_FILE, "utf8"));
  const save = () => writeFile(CITIES_FILE, `${JSON.stringify(cities, null, 2)}\n`);
  const todo = cities.filter((c) => FORCE || !c.images?.length);
  let done = 0;

  for (const city of todo) {
    const { images, remaining, rateLimited } = await searchCity(city);
    if (rateLimited) {
      console.warn("Rate limit reached, run again later to resume.");
      break;
    }
    city.images = images;
    done++;
    // Saved after each city so a rate-limit stop doesn't lose progress.
    await save();
    console.log(`${city.name}: ${images.length} images (rate limit remaining: ${remaining})`);
    if (remaining === 0) {
      console.warn("Rate limit exhausted, run again later to resume.");
      break;
    }
  }

  const missing = cities.filter((c) => !c.images?.length).map((c) => c.name);
  console.log(`Updated ${done}/${todo.length} cities. Without images: ${missing.length ? missing.join(", ") : "none"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
