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

test("prefers popular farms and limits the list to three", () => {
  const farms = [
    { id: "1", category: "other" },
    { id: "2", category: "popular" },
    { id: "3", category: "popular" },
    { id: "4", category: "popular" },
    { id: "5", category: "popular" },
  ];

  assert.deepEqual(
    getPopularFarms(farms).map((farm) => farm.id),
    ["2", "3", "4"],
  );
});

test("falls back to the first three farms when none are categorized popular", () => {
  const farms = [
    { id: "1", category: "other" },
    { id: "2", category: "other" },
    { id: "3", category: "other" },
    { id: "4", category: "other" },
  ];

  assert.deepEqual(
    getPopularFarms(farms).map((farm) => farm.id),
    ["1", "2", "3"],
  );
  assert.deepEqual(getPopularFarms([]), []);
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
