import assert from "node:assert/strict";
import test from "node:test";
import {
  getFarmImageUrl,
  getFeaturedFarms,
  getLocatedFarms,
  getPopularFarms,
  filterFarmsByQuery,
  buildContactMailto,
} from "../../src/lib/homepage.mjs";
import * as homepage from "../../src/lib/homepage.mjs";

test("includes trending and popular-category farms but excludes unrelated farms", () => {
  const farms = [
    { id: "trending", is_trending: true, category: "other" },
    { id: "popular", category: "popular" },
    { id: "unrelated", category: "other" },
  ];

  assert.deepEqual(
    getPopularFarms(farms).map((farm) => farm.id),
    ["trending", "popular"],
  );
});

test("does not label unrelated farms as popular when no farm is popular", () => {
  const farms = [
    { id: "1", category: "other" },
    { id: "2", category: "other" },
    { id: "3", category: "other" },
    { id: "4", category: "other" },
  ];

  assert.deepEqual(getPopularFarms(farms), []);
  assert.deepEqual(getPopularFarms([]), []);
});

test("matches wet and dry season using season or category without excluding other sections", () => {
  const farms = [
    { id: "wet-season", season: "Wet Season", category: "popular", is_trending: true },
    { id: "wet-category", season: "year-round", category: "WET season" },
    { id: "dry-season", season: "Dry Season", category: "" },
    { id: "dry-category", season: "", category: "dry season" },
    { id: "unrelated", season: "year-round", category: "popular" },
  ];

  assert.deepEqual(
    homepage.getWetSeasonFarms?.(farms).map((farm) => farm.id) ?? [],
    ["wet-season", "wet-category"],
  );
  assert.deepEqual(
    homepage.getDrySeasonFarms?.(farms).map((farm) => farm.id) ?? [],
    ["dry-season", "dry-category"],
  );
  assert.deepEqual(
    getPopularFarms(farms).map((farm) => farm.id),
    ["wet-season", "unrelated"],
  );
});

test("selects trending or headline farms and falls back when none are featured", () => {
  const farms = [
    { id: "1" },
    { id: "2", is_trending: true },
    { id: "3", headline: "Harvest season" },
    { id: "4", headline: " " },
  ];

  assert.deepEqual(
    getFeaturedFarms(farms).map((farm) => farm.id),
    ["2", "3"],
  );
  assert.deepEqual(
    getFeaturedFarms(farms.slice(0, 1)).map((farm) => farm.id),
    ["1"],
  );
  assert.deepEqual(getFeaturedFarms([]), []);
});

test("excludes farms without valid geographic coordinates", () => {
  const farms = [
    { id: "valid", latitude: 14.5, longitude: 121.1 },
    { id: "string", latitude: "14.5", longitude: "121.1" },
    { id: "missing", latitude: null, longitude: 121 },
    { id: "empty", latitude: "", longitude: 121 },
    { id: "latitude-range", latitude: 91, longitude: 0 },
    { id: "longitude-range", latitude: 0, longitude: -181 },
  ];

  assert.deepEqual(
    getLocatedFarms(farms).map((farm) => farm.id),
    ["valid", "string"],
  );
});

test("uses supported image URLs and falls back for missing or unsafe paths", () => {
  assert.equal(
    getFarmImageUrl({
      images: ["javascript:alert(1)", "https://cdn.example.com/farm.jpg"],
    }),
    "https://cdn.example.com/farm.jpg",
  );
  assert.equal(
    getFarmImageUrl({ images: "images/farm.jpg" }),
    "/images/farm.jpg",
  );
  assert.equal(getFarmImageUrl({ images: ["images/../secret.jpg"] }), "/farm-placeholder.svg");
  assert.equal(getFarmImageUrl({ images: [] }), "/farm-placeholder.svg");
});

test("returns ordered safe farm gallery URLs without placeholders", () => {
  assert.deepEqual(
    homepage.getFarmImageUrls?.({
      images: [
        "javascript:alert(1)",
        "https://cdn.example.com/one.jpg",
        "/images/two.jpg",
        "//example.com/unsafe.jpg",
        "data:image/png;base64,abc",
        "/farm-placeholder.svg",
        "images/../private.jpg",
      ],
    }),
    ["https://cdn.example.com/one.jpg", "/images/two.jpg"],
  );
  assert.deepEqual(
    homepage.getFarmImageUrls?.({ images: "images/single.jpg" }),
    ["/images/single.jpg"],
  );
  assert.deepEqual(homepage.getFarmImageUrls?.({}), []);
});

test("accepts only safe direct farm video URLs", () => {
  assert.equal(homepage.getFarmVideoUrl?.(undefined), null);
  assert.equal(
    homepage.getFarmVideoUrl?.("https://cdn.example.com/walkthrough.mp4"),
    "https://cdn.example.com/walkthrough.mp4",
  );
  assert.equal(
    homepage.getFarmVideoUrl?.("/videos/walkthrough.webm"),
    "/videos/walkthrough.webm",
  );
  for (const unsafeUrl of [
    "javascript:alert(1)",
    "data:video/mp4,abc",
    "//example.com/walkthrough.mp4",
    "http://example.com/walkthrough.mp4",
  ]) {
    assert.equal(homepage.getFarmVideoUrl?.(unsafeUrl), null);
  }
});

test("formats farm detail strings arrays objects and empty values", () => {
  assert.equal(homepage.formatFarmDetailValue?.("  Rizal  "), "Rizal");
  assert.equal(homepage.formatFarmDetailValue?.(0), "0");
  assert.equal(
    homepage.formatFarmDetailValue?.([" Mango ", "", 2]),
    "Mango, 2",
  );
  assert.equal(
    homepage.formatFarmDetailValue?.({
      adults: 4,
      children: ["2", "3"],
      note: " ",
    }),
    "adults: 4; children: 2, 3",
  );
  assert.equal(homepage.formatFarmDetailValue?.("  "), "");
  assert.equal(homepage.formatFarmDetailValue?.(null), "");
});

test("appends only trimmed non-empty local chat messages", () => {
  const messages = [{ id: "existing", text: "Hello" }];

  assert.equal(
    homepage.appendFarmChatMessage?.(messages, " \n ", "ignored"),
    messages,
  );
  assert.deepEqual(
    homepage.appendFarmChatMessage?.(messages, "  Let's visit!  ", "new"),
    [...messages, { id: "new", text: "Let's visit!" }],
  );
});

test("filters farms by name, description, location, province, and crops", () => {
  const farms = [
    { id: "name", name: "Golden Mango" },
    { id: "description", description: "Seasonal citrus" },
    { id: "location", location: "Rizal" },
    { id: "province", province: "Batangas" },
    { id: "crops", crops: ["Pineapple"] },
  ];

  assert.deepEqual(
    filterFarmsByQuery(farms, "mAnGo"),
    [farms[0]],
  );
  assert.deepEqual(
    filterFarmsByQuery(farms, "citrus"),
    [farms[1]],
  );
  assert.deepEqual(filterFarmsByQuery(farms, "rizal"), [farms[2]]);
  assert.deepEqual(filterFarmsByQuery(farms, "batangas"), [farms[3]]);
  assert.deepEqual(filterFarmsByQuery(farms, "pineapple"), [farms[4]]);
});

test("returns all farms when the search query is empty", () => {
  const farms = [{ id: "1" }, { id: "2" }];

  assert.deepEqual(filterFarmsByQuery(farms, ""), farms);
  assert.deepEqual(filterFarmsByQuery(farms, "  "), farms);
});

test("builds an encoded contact email from the submitted form fields", () => {
  const mailto = new URL(
    buildContactMailto({
      name: " Ana Cruz ",
      email: "ana@example.com",
      message: "I would like to visit.",
    }),
  );

  assert.equal(mailto.protocol, "mailto:");
  assert.equal(mailto.pathname, "sagana077@gmail.com");
  assert.equal(mailto.searchParams.get("subject"), "SAGANA farm inquiry from Ana Cruz");
  assert.equal(
    mailto.searchParams.get("body"),
    "Name: Ana Cruz\nEmail: ana@example.com\n\nI would like to visit.",
  );
});
