import { createHash, randomBytes } from "node:crypto";

export function createOpaqueToken() {
  const token = randomBytes(32).toString("base64url");

  return { token, hash: hashToken(token) };
}

export function hashToken(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new TypeError("A non-empty token is required.");
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}
