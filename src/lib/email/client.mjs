import "server-only";
import QRCode from "qrcode";
import { requireServerEnv } from "../config/env.mjs";
import { createBrevoEmailClient } from "./brevo.mjs";
import {
  createAdminReservationMessage,
  createVisitorStatusMessage,
} from "./templates.mjs";

export function createEmailClient() {
  const { BREVO_API_KEY } = requireServerEnv(["BREVO_API_KEY"]);

  return createBrevoEmailClient(BREVO_API_KEY);
}

async function sendMessage(emailClient, message) {
  const { error } = await emailClient.emails.send(message);

  if (error) {
    throw error;
  }
}

export async function sendAdminReservationEmail(
  reservation,
  { actionUrl, retryUrl },
  emailClient,
) {
  const { FARM_ADMIN_EMAIL, RESERVATION_FROM_EMAIL } = requireServerEnv([
    "FARM_ADMIN_EMAIL",
    "RESERVATION_FROM_EMAIL",
  ]);
  const message = createAdminReservationMessage(reservation, {
    actionUrl,
    retryUrl,
    from: RESERVATION_FROM_EMAIL,
    to: FARM_ADMIN_EMAIL,
  });

  await sendMessage(emailClient, message);
}

export async function sendVisitorStatusEmail(
  reservation,
  status,
  { ticketUrl, qrDataUrl },
  emailClient,
) {
  const { RESERVATION_FROM_EMAIL } = requireServerEnv([
    "RESERVATION_FROM_EMAIL",
  ]);
  const message = createVisitorStatusMessage(
    reservation,
    status,
    { ticketUrl, qrDataUrl },
    { from: RESERVATION_FROM_EMAIL },
  );

  await sendMessage(emailClient, message);
}

export function createTicketQrDataUrl(ticketUrl) {
  return QRCode.toDataURL(ticketUrl, {
    errorCorrectionLevel: "M",
    type: "image/png",
  });
}
