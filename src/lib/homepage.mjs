const FARM_IMAGE_FALLBACK = "/farm-placeholder.svg";
const MAX_FEATURED_FALLBACKS = 3;

function asFarmList(farms) {
  return Array.isArray(farms) ? farms : [];
}

function containsLabel(value, label) {
  const values = Array.isArray(value) ? value : [value];

  return values.some(
    (item) =>
      typeof item === "string" &&
      item.toLowerCase().includes(label),
  );
}

function numericCoordinate(value) {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || value.trim() === "")
  ) {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

export function getPopularFarms(farms) {
  return asFarmList(farms).filter(
    (farm) =>
      farm?.is_trending === true ||
      (typeof farm?.category === "string" &&
        farm.category.trim().toLowerCase() === "popular"),
  );
}

export function getWetSeasonFarms(farms) {
  return asFarmList(farms).filter(
    (farm) =>
      containsLabel(farm?.season, "wet") ||
      containsLabel(farm?.category, "wet"),
  );
}

export function getDrySeasonFarms(farms) {
  return asFarmList(farms).filter(
    (farm) =>
      containsLabel(farm?.season, "dry") ||
      containsLabel(farm?.category, "dry"),
  );
}

export function getFeaturedFarms(farms) {
  const list = asFarmList(farms);
  const featured = list.filter(
    (farm) =>
      farm?.is_trending ||
      (typeof farm?.headline === "string" && farm.headline.trim().length > 0),
  );
  return featured.length > 0 ? featured : list.slice(0, MAX_FEATURED_FALLBACKS);
}

export function getLocatedFarms(farms) {
  return asFarmList(farms).filter((farm) => {
    const latitude = numericCoordinate(farm?.latitude);
    const longitude = numericCoordinate(farm?.longitude);

    return (
      latitude !== null &&
      longitude !== null &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  });
}

export function getFarmImageUrl(farm) {
  const candidates = Array.isArray(farm?.images) ? farm.images : [farm?.images];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const imagePath = candidate.trim();
    if (/^https:\/\//i.test(imagePath) && URL.canParse(imagePath)) {
      return new URL(imagePath).href;
    }

    if (imagePath.startsWith("//") || !/^[A-Za-z0-9._/-]+$/.test(imagePath)) {
      continue;
    }

    const localPath = imagePath.replace(/^\/+/, "");
    if (
      !localPath ||
      localPath.split("/").includes("..") ||
      localPath.endsWith("/")
    ) {
      continue;
    }

    return `/${localPath}`;
  }

  return FARM_IMAGE_FALLBACK;
}

export function filterFarmsByQuery(farms, query) {
  const list = asFarmList(farms);
  const normalizedQuery = typeof query === "string" ? query.trim().toLowerCase() : "";

  if (!normalizedQuery) {
    return list;
  }

  return list.filter((farm) => {
    const crops = Array.isArray(farm?.crops) ? farm.crops : [farm?.crops];
    const searchableValues = [
      farm?.name,
      farm?.description,
      farm?.location,
      farm?.province,
      ...crops,
    ];

    return searchableValues.some(
      (value) =>
        typeof value === "string" &&
        value.toLowerCase().includes(normalizedQuery),
    );
  });
}

export function buildContactMailto({ name, email, message } = {}) {
  const contactName = typeof name === "string" ? name.trim() : "";
  const contactEmail = typeof email === "string" ? email.trim() : "";
  const contactMessage = typeof message === "string" ? message.trim() : "";
  const params = new URLSearchParams({
    subject: `SAGANA farm inquiry from ${contactName}`,
    body: `Name: ${contactName}\nEmail: ${contactEmail}\n\n${contactMessage}`,
  });

  return `mailto:sagana077@gmail.com?${params}`;
}
