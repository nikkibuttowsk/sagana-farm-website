import {
  createEmailClient,
  sendAdminReservationEmail,
  sendVisitorPendingEmail,
} from "@/lib/email/client.mjs";
import { requireServerEnv } from "@/lib/config/env.mjs";
import {
  getTrustedClientIp,
  hashRateLimitIdentifier,
} from "@/lib/reservations/rate-limit.mjs";
import { createOpaqueToken } from "@/lib/reservations/tokens.mjs";
import { submitReservation as submitReservationWorkflow } from "@/lib/reservations/workflow.mjs";
import { createAdminSupabaseClient } from "@/lib/supabase/clients.mjs";
import { postReservation } from "@/lib/reservations/http.mjs";
import {
  claimReservationSubmissionRateLimit,
  createPendingReservation,
  findReplayedReservation,
  markAdminEmailSent,
} from "@/lib/reservations/repository.mjs";

// A repeat that arrives while the first request is still sending its emails
// should not look like a failure.
const IN_FLIGHT_WINDOW_MS = 60 * 1000;

export async function POST(request) {
  let appBaseUrl;

  try {
    ({ APP_BASE_URL: appBaseUrl } = requireServerEnv(["APP_BASE_URL"]));
    new URL(appBaseUrl);
  } catch {
    return Response.json(
      { error: "Reservation service is not configured." },
      { status: 503 },
    );
  }

  let client;
  const getAdminClient = () => {
    client ??= createAdminSupabaseClient();
    return client;
  };

  return postReservation(request, {
    appBaseUrl,
    async findReplayedReservation(input) {
      const existing = await findReplayedReservation(input, getAdminClient());

      if (!existing) {
        return null;
      }

      const createdAt = new Date(existing.created_at).getTime();
      const stillSending = Date.now() - createdAt < IN_FLIGHT_WINDOW_MS;

      return {
        reference: existing.id,
        notificationSent: Boolean(existing.admin_email_sent_at) || stillSending,
      };
    },
    async claimReservationRateLimit(input, currentRequest) {
      const { RATE_LIMIT_SECRET } = requireServerEnv(["RATE_LIMIT_SECRET"]);
      const clientIp = getTrustedClientIp(currentRequest);

      return claimReservationSubmissionRateLimit(
        hashRateLimitIdentifier("ip", clientIp, RATE_LIMIT_SECRET),
        hashRateLimitIdentifier(
          "email",
          input.visitorEmail,
          RATE_LIMIT_SECRET,
        ),
        getAdminClient(),
      );
    },
    async submitReservation(input) {
      return submitReservationWorkflow(input, {
        repository: {
          createPendingReservation: (value, actionHash, retryHash) =>
            createPendingReservation(
              value,
              actionHash,
              retryHash,
              getAdminClient(),
            ),
          markAdminEmailSent: (reservationId) =>
            markAdminEmailSent(reservationId, getAdminClient()),
        },
        email: {
          sendAdminReservationEmail: (reservation, urls) =>
            sendAdminReservationEmail(reservation, urls, createEmailClient()),
          sendVisitorPendingEmail: (reservation) =>
            sendVisitorPendingEmail(reservation, createEmailClient()),
        },
        createOpaqueToken,
        appBaseUrl,
      });
    },
  });
}