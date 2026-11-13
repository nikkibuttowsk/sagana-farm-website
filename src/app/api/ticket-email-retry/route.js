import { createEmailClient, createTicketQrDataUrl, sendVisitorStatusEmail } from "@/lib/email/client.mjs";
import { requireServerEnv } from "@/lib/config/env.mjs";
import { postTicketEmailRetry } from "@/lib/reservations/http.mjs";
import { createOpaqueToken } from "@/lib/reservations/tokens.mjs";
import { retryVisitorTicketEmail as retryWorkflow } from "@/lib/reservations/workflow.mjs";
import { createAdminSupabaseClient } from "@/lib/supabase/clients.mjs";
import { claimTicketEmailRetry } from "@/lib/reservations/repository.mjs";

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

  return postTicketEmailRetry(request, {
    appBaseUrl,
    async retryVisitorTicketEmail(input) {
      const client = createAdminSupabaseClient();

      return retryWorkflow(input, {
        repository: {
          claimTicketEmailRetry: (token, replacementHash) =>
            claimTicketEmailRetry(token, replacementHash, client),
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
