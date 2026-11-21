import { reportError } from "../logging.mjs";

function buildUrl(baseUrl, path, values) {
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(values)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export async function submitReservation(input, deps) {
  const actionToken = deps.createOpaqueToken();
  const retryToken = deps.createOpaqueToken();
  let reservation;

  try {
    reservation = await deps.repository.createPendingReservation(
      input,
      actionToken.hash,
      retryToken.hash,
    );
  } catch (error) {
    // Same submit arrived again (double click, retry): return the original
    // reservation and do NOT send the emails a second time.
    if (error?.name === "DuplicateReservationError") {
      return {
        reference: error.reservation.id,
        notificationSent: true,
        replayed: true,
      };
    }

    throw error;
  }

  const actionUrl = buildUrl(
    deps.appBaseUrl,
    "/reservation/action",
    { token: actionToken.token },
  );
  const retryUrl = buildUrl(
    deps.appBaseUrl,
    "/reservation/ticket-email",
    { token: retryToken.token },
  );

  let notificationSent = false;

  try {
    await deps.email.sendAdminReservationEmail(reservation, {
      actionUrl,
      retryUrl,
    });
    notificationSent = true;
  } catch (error) {
    reportError(deps, error, "Could not send admin reservation email.");
  }

  if (notificationSent && typeof deps.repository.markAdminEmailSent === "function") {
    try {
      await deps.repository.markAdminEmailSent(reservation.id);
    } catch (error) {
      reportError(deps, error, "Could not record admin email delivery.");
    }
  }

  if (typeof deps.email.sendVisitorPendingEmail === "function") {
    try {
      await deps.email.sendVisitorPendingEmail(reservation);
    } catch (error) {
      reportError(deps, error, "Could not send visitor pending receipt email.");
    }
  }

  return { reference: reservation.id, notificationSent };
}

export async function handleReservationDecision({ token, decision }, deps) {
  const ticketToken =
    decision === "approve" ? deps.createOpaqueToken() : null;
  const result = await deps.repository.decideReservation(
    token,
    decision,
    ticketToken?.hash,
  );

  if (!result.ok) {
    return { status: result.reason, visitorEmailSent: false };
  }

  const reservation = result.reservation;

  try {
    let ticket = {};

    if (decision === "approve") {
      const ticketUrl = buildUrl(
        deps.appBaseUrl,
        `/ticket/${encodeURIComponent(ticketToken.token)}`,
        {},
      );
      ticket = {
        ticketUrl,
        qrDataUrl: await deps.createTicketQrDataUrl(ticketUrl),
      };
    }

    await deps.email.sendVisitorStatusEmail(
      reservation,
      reservation.status,
      ticket,
    );
    return { status: reservation.status, visitorEmailSent: true };
  } catch (error) {
    reportError(deps, error, "Could not send reservation status email.");
    return { status: reservation.status, visitorEmailSent: false };
  }
}

export async function retryVisitorTicketEmail({ token }, deps) {
  const replacementTicketToken = deps.createOpaqueToken();
  const reservation = await deps.repository.claimTicketEmailRetry(
    token,
    replacementTicketToken.hash,
  );

  if (!reservation || reservation.status !== "approved") {
    return false;
  }

  const ticketUrl = buildUrl(
    deps.appBaseUrl,
    `/ticket/${encodeURIComponent(replacementTicketToken.token)}`,
    {},
  );
  const qrDataUrl = await deps.createTicketQrDataUrl(ticketUrl);

  await deps.email.sendVisitorStatusEmail(
    reservation,
    "approved",
    { ticketUrl, qrDataUrl },
  );

  return true;
}