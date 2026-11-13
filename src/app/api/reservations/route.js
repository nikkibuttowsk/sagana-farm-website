import { createEmailClient, sendAdminReservationEmail } from "@/lib/email/client.mjs";
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
} from "@/lib/reservations/repository.mjs";

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
        },
        email: {
          sendAdminReservationEmail: (reservation, urls) =>
            sendAdminReservationEmail(reservation, urls, createEmailClient()),
        },
        createOpaqueToken,
        appBaseUrl,
      });
    },
  });
}
