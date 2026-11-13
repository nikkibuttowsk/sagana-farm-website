import { createEmailClient, createTicketQrDataUrl, sendVisitorStatusEmail } from "@/lib/email/client.mjs";
import { requireServerEnv } from "@/lib/config/env.mjs";
import { postReservationAction } from "@/lib/reservations/http.mjs";
import { createOpaqueToken } from "@/lib/reservations/tokens.mjs";
import { handleReservationDecision as handleDecisionWorkflow } from "@/lib/reservations/workflow.mjs";
import { createAdminSupabaseClient } from "@/lib/supabase/clients.mjs";
import { decideReservation } from "@/lib/reservations/repository.mjs";

export async function POST(request) {
  let appBaseUrl;

  try {
    ({ APP_BASE_URL: appBaseUrl } = requireServerEnv(["APP_BASE_URL"]));
    new URL(appBaseUrl);
  } catch {
    return new Response("Reservation service is not configured.", {
      status: 503,
    });
  }

  return postReservationAction(request, {
    appBaseUrl,
    async handleReservationDecision(input) {
      const client = createAdminSupabaseClient();

      return handleDecisionWorkflow(input, {
        repository: {
          decideReservation: (token, decision, ticketHash) =>
            decideReservation(token, decision, ticketHash, client),
        },
        email: {
          sendVisitorStatusEmail: (reservation, status, ticket) =>
            sendVisitorStatusEmail(
              reservation,
              status,
              ticket,
              createEmailClient(),
            ),
        },
        createOpaqueToken,
        createTicketQrDataUrl,
        appBaseUrl,
      });
    },
  });
}
