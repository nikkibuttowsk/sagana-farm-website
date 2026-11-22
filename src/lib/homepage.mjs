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

function safeFarmAssetUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const assetPath = value.trim();
  if (/^https:\/\//i.test(assetPath) && URL.canParse(assetPath)) {
    return new URL(assetPath).href;
  }

  if (assetPath.startsWith("//") || !/^[A-Za-z0-9._/-]+$/.test(assetPath)) {
    return null;
  }

  const localPath = assetPath.replace(/^\/+/, "");
  if (
    !localPath ||
    localPath.split("/").includes("..") ||
    localPath.endsWith("/")
  ) {
    return null;
  }

  return `/${localPath}`;
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

export function getUncategorizedFarms(farms) {
  return asFarmList(farms).filter(
    (farm) =>
      typeof farm?.category !== "string" || farm.category.trim().length === 0,
  );
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
    const imageUrl = safeFarmAssetUrl(candidate);
    if (imageUrl) {
      return imageUrl;
    }
  }

  return FARM_IMAGE_FALLBACK;
}

export function getFarmImageUrls(farm) {
  const candidates = Array.isArray(farm?.images) ? farm.images : [farm?.images];

  return candidates
    .map(safeFarmAssetUrl)
    .filter((imageUrl) => imageUrl && imageUrl !== FARM_IMAGE_FALLBACK);
}

export function getFarmVideoUrl(value) {
  return safeFarmAssetUrl(value);
}

export function formatFarmDetailValue(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (Array.isArray(value)) {
    return value.map(formatFarmDetailValue).filter(Boolean).join(", ");
  }

  if (
    value &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  ) {
    return Object.entries(value)
      .map(([key, item]) => {
        const formattedValue = formatFarmDetailValue(item);
        return formattedValue ? `${key}: ${formattedValue}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }

  return "";
}

export function appendFarmChatMessage(messages, text, id) {
  const trimmedText = typeof text === "string" ? text.trim() : "";
  if (!trimmedText) {
    return messages;
  }

  return [...messages, { id, text: trimmedText }];
}

export function getFarmChatReply(response, { email = "", question = "" } = {}) {
  if (response?.status === "answered" && typeof response.answer === "string") {
    return { pendingQuestion: null, reply: response.answer };
  }
  if (response?.status === "needs_email") {
    return {
      pendingQuestion: question,
      reply:
        "I can't answer that from this farm's listing. Type your email below and I'll send your question to the farm so they can reply.",
    };
  }
  if (response?.status === "escalated") {
    return {
      pendingQuestion: null,
      reply:
        response.emailSent === false
          ? "Thanks! We saved your question and will pass it to the farm."
          : "Thanks! Your question was sent to the farm. They can reply to the email you provided.",
    };
  }
  return {
    pendingQuestion: null,
    reply: response?.error || "Sorry, something went wrong. Please try again.",
  };
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
