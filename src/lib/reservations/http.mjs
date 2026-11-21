import {
  ServerConfigurationError,
} from "../config/env.mjs";
import {
  ReservationValidationError,
  validateReservation,
} from "./validation.mjs";
import { reportError } from "../logging.mjs";

const MAX_BODY_BYTES = 32 * 1024;
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function jsonResponse(body, status, headers = {}) {
  return Response.json(body, { status, headers });
}

function hasExpectedOrigin(request, appBaseUrl) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(appBaseUrl).origin;
  } catch {
    return false;
  }
}

async function readBoundedBody(request) {
  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { ok: false };
  }

  if (!request.body) {
    return { ok: true, text: "" };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      size += value.byteLength;

      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return { ok: false };
      }

      chunks.push(value);
    }
  } catch {
    return { ok: false };
  }

  const body = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(body) };
}

async function readFormFields(request, text) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.startsWith("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }

  if (contentType.startsWith("multipart/form-data")) {
    const formRequest = new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body: text,
    });
    const formData = await formRequest.formData();

    return Object.fromEntries(formData.entries());
  }

  return null;
}

function redirectToResult(appBaseUrl, values) {
  const url = new URL("/reservation/action/result", appBaseUrl);

  for (const [key, value] of Object.entries(values)) {
    url.searchParams.set(key, value);
  }

  return new Response(null, {
    status: 303,
    headers: { location: url.toString() },
  });
}

function redirectToRetry(appBaseUrl, status) {
  const url = new URL("/reservation/ticket-email", appBaseUrl);
  url.searchParams.set("status", status);

  return new Response(null, {
    status: 303,
    headers: { location: url.toString() },
  });
}

export async function postReservation(request, deps) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  if (!hasExpectedOrigin(request, deps.appBaseUrl)) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403);
  }

  const body = await readBoundedBody(request);

  if (!body.ok) {
    return jsonResponse({ error: "Request body is too large or unreadable." }, 413);
  }

  let input;

  try {
    input = JSON.parse(body.text);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return jsonResponse({ error: "Reservation details are invalid." }, 400);
  }

  if (typeof input.website === "string" && input.website.trim()) {
    return jsonResponse({ error: "Reservation details are invalid." }, 400);
  }

  const validation = (deps.validateReservation ?? validateReservation)(input);

  if (!validation.ok) {
    return jsonResponse(
      { error: "Reservation details are invalid.", errors: validation.errors },
      422,
    );
  }

  try {
    // Same submit seen before (double click, retry)? Answer with the original result.
    // This runs BEFORE rate limiting, so a repeat does not use up the visitor's allowance.
    if (
      validation.value.idempotencyKey &&
      typeof deps.findReplayedReservation === "function"
    ) {
      const replay = await deps.findReplayedReservation(validation.value);

      if (replay) {
        return jsonResponse(
          {
            saved: true,
            reference: replay.reference,
            notificationSent: replay.notificationSent,
            replayed: true,
          },
          replay.notificationSent ? 200 : 503,
        );
      }
    }

    const rateLimit = await deps.claimReservationRateLimit(
      validation.value,
      request,
    );

    if (typeof rateLimit?.allowed !== "boolean") {
      throw new Error("Reservation rate-limit result is invalid.");
    }

    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: "Too many reservation requests. Please try again later." },
        429,
        { "retry-after": String(rateLimit.retryAfterSeconds) },
      );
    }

    const result = await deps.submitReservation(validation.value);

    return jsonResponse(
      {
        saved: true,
        reference: result.reference,
        notificationSent: result.notificationSent,
        ...(result.replayed ? { replayed: true } : {}),
      },
      result.replayed ? 200 : result.notificationSent ? 201 : 503,
    );
  } catch (error) {
    reportError(deps, error, "Could not save farm reservation.");

    if (error instanceof ServerConfigurationError) {
      return jsonResponse(
        { error: "Reservation service is not configured." },
        503,
      );
    }

    if (error instanceof ReservationValidationError) {
      return jsonResponse(
        { error: "Reservation details are invalid.", errors: error.errors },
        422,
      );
    }

    return jsonResponse({ error: "Unable to save reservation." }, 500);
  }
}

export async function postReservationAction(request, deps) {
  if (request.method !== "POST") {
    return new Response("Method not allowed.", { status: 405 });
  }

  if (!hasExpectedOrigin(request, deps.appBaseUrl)) {
    return new Response("Request origin is not allowed.", { status: 403 });
  }

  const body = await readBoundedBody(request);

  if (!body.ok) {
    return new Response("Request body is too large or unreadable.", {
      status: 413,
    });
  }

  let fields;

  try {
    fields = await readFormFields(request, body.text);
  } catch {
    return redirectToResult(deps.appBaseUrl, { status: "invalid" });
  }

  const token = fields?.token;
  const decision = fields?.decision;

  if (
    typeof token !== "string" ||
    !OPAQUE_TOKEN_PATTERN.test(token) ||
    (decision !== "approve" && decision !== "reject")
  ) {
    return redirectToResult(deps.appBaseUrl, { status: "invalid" });
  }

  try {
    const result = await deps.handleReservationDecision({ token, decision });

    return redirectToResult(deps.appBaseUrl, {
      status: result.status,
      email: result.visitorEmailSent ? "sent" : "failed",
    });
  } catch (error) {
    reportError(deps, error, "Could not process farm reservation decision.");
    return redirectToResult(deps.appBaseUrl, { status: "error" });
  }
}

export async function postTicketEmailRetry(request, deps) {
  if (request.method !== "POST") {
    return new Response("Method not allowed.", { status: 405 });
  }

  if (!hasExpectedOrigin(request, deps.appBaseUrl)) {
    return new Response("Request origin is not allowed.", { status: 403 });
  }

  const body = await readBoundedBody(request);

  if (!body.ok) {
    return new Response("Request body is too large or unreadable.", {
      status: 413,
    });
  }

  let fields;

  try {
    fields = await readFormFields(request, body.text);
  } catch {
    return redirectToRetry(deps.appBaseUrl, "invalid");
  }

  const token = fields?.token;

  if (typeof token !== "string" || !OPAQUE_TOKEN_PATTERN.test(token)) {
    return redirectToRetry(deps.appBaseUrl, "invalid");
  }

  try {
    const sent = await deps.retryVisitorTicketEmail({ token });

    return redirectToRetry(deps.appBaseUrl, sent ? "sent" : "unavailable");
  } catch (error) {
    reportError(deps, error, "Could not retry farm visit ticket email.");
    return redirectToRetry(deps.appBaseUrl, "failed");
  }
}