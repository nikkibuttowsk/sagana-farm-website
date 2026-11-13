import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { ServerConfigurationError } from "../config/env.mjs";

const RATE_LIMIT_SCOPES = new Set(["ip", "email"]);

export function getTrustedClientIp(request) {
  const forwardedIp = request.headers.get("x-forwarded-for")?.trim();

  if (!forwardedIp || forwardedIp.includes(",") || isIP(forwardedIp) === 0) {
    throw new ServerConfigurationError(
      "A single trusted client IP is required for reservation throttling.",
    );
  }

  return forwardedIp.toLowerCase();
}

export function hashRateLimitIdentifier(scope, value, secret) {
  if (!RATE_LIMIT_SCOPES.has(scope)) {
    throw new TypeError("Rate-limit scope must be ip or email.");
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("A rate-limit identifier is required.");
  }

  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) {
    throw new ServerConfigurationError(
      "RATE_LIMIT_SECRET must contain at least 32 bytes.",
    );
  }

  return createHmac("sha256", secret)
    .update(`${scope}\0${value}`, "utf8")
    .digest("hex");
}
