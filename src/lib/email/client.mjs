import "server-only";
import QRCode from "qrcode";
import { requireServerEnv } from "../config/env.mjs";
import { createBrevoEmailClient } from "./brevo.mjs";
import {
  createAdminReservationMessage,
  createFarmQuestionMessage,
  createVisitorPendingMessage,
  createVisitorStatusMessage,
  createAdminFarmRegistrationMessage,
  createFarmOwnerPendingMessage,
  createFarmOwnerStatusMessage,
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

export async function sendFarmQuestionEmail(details, { to }, emailClient) {
  const { RESERVATION_FROM_EMAIL } = requireServerEnv(["RESERVATION_FROM_EMAIL"]);
  const message = createFarmQuestionMessage(details, {
    from: RESERVATION_FROM_EMAIL,
    to,
  });

  await sendMessage(emailClient, message);
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

export async function sendVisitorPendingEmail(reservation, emailClient) {
  const { RESERVATION_FROM_EMAIL } = requireServerEnv([
    "RESERVATION_FROM_EMAIL",
  ]);
  const message = createVisitorPendingMessage(reservation, {
    from: RESERVATION_FROM_EMAIL,
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

export async function sendAdminFarmRegistrationEmail(
  farm,
  { actionUrl },
  emailClient,
) {
  const { FARM_ADMIN_EMAIL, RESERVATION_FROM_EMAIL } = requireServerEnv([
    "FARM_ADMIN_EMAIL",
    "RESERVATION_FROM_EMAIL",
  ]);
  const message = createAdminFarmRegistrationMessage(farm, {
    actionUrl,
    from: RESERVATION_FROM_EMAIL,
    to: FARM_ADMIN_EMAIL,
  });

  await sendMessage(emailClient, message);
}

export async function sendFarmOwnerPendingEmail(farm, emailClient) {
  const { RESERVATION_FROM_EMAIL } = requireServerEnv([
    "RESERVATION_FROM_EMAIL",
  ]);
  const message = createFarmOwnerPendingMessage(farm, {
    from: RESERVATION_FROM_EMAIL,
  });

  await sendMessage(emailClient, message);
}

export async function sendFarmOwnerStatusEmail(
  farm,
  status,
  { farmUrl } = {},
  emailClient,
) {
  const { RESERVATION_FROM_EMAIL } = requireServerEnv([
    "RESERVATION_FROM_EMAIL",
  ]);
  const message = createFarmOwnerStatusMessage(
    farm,
    status,
    { farmUrl },
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