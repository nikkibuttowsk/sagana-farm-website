function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function getQueryParameter(value, key) {
  return new URL(value).searchParams.get(key) ?? "";
}

function reservationDetails(reservation) {
  return [
    `Visitor: ${reservation.visitor_name}`,
    `Email: ${reservation.visitor_email}`,
    `Phone: ${reservation.visitor_phone}`,
    `Farm: ${reservation.farm_name}`,
    `Date: ${reservation.visit_date}`,
    `Time: ${reservation.time_slot_label}`,
    `Guests: ${reservation.guest_count}`,
  ].join("\n");
}

export function createAdminReservationMessage(
  reservation,
  { actionUrl, retryUrl, from, to },
) {
  const actionToken = getQueryParameter(actionUrl, "token");
  const retryToken = getQueryParameter(retryUrl, "token");
  const actionEndpoint = `${new URL(actionUrl).origin}/api/reservation-action`;
  const retryEndpoint = `${new URL(retryUrl).origin}/api/ticket-email-retry`;
  const details = reservationDetails(reservation);
  const hiddenToken = `<input type="hidden" name="token" value="${escapeHtml(actionToken)}">`;

  return {
    from,
    to,
    subject: `Reservation request for ${reservation.farm_name}`,
    text: `${details}\n\nReview and decide: ${actionUrl}\nRetry visitor ticket email: ${retryUrl}`,
    html: `<main>
      <h1>Farm visit reservation request</h1>
      <dl>
        <dt>Visitor</dt><dd>${escapeHtml(reservation.visitor_name)}</dd>
        <dt>Email</dt><dd>${escapeHtml(reservation.visitor_email)}</dd>
        <dt>Phone</dt><dd>${escapeHtml(reservation.visitor_phone)}</dd>
        <dt>Farm</dt><dd>${escapeHtml(reservation.farm_name)}</dd>
        <dt>Date</dt><dd>${escapeHtml(reservation.visit_date)}</dd>
        <dt>Time</dt><dd>${escapeHtml(reservation.time_slot_label)}</dd>
        <dt>Guests</dt><dd>${escapeHtml(reservation.guest_count)}</dd>
      </dl>
      <form method="post" action="${escapeHtml(actionEndpoint)}">
        ${hiddenToken}<button name="decision" value="approve">Approve</button>
      </form>
      <form method="post" action="${escapeHtml(actionEndpoint)}">
        ${hiddenToken}<button name="decision" value="reject">Reject</button>
      </form>
      <p><a href="${escapeHtml(actionUrl)}">Review this request</a></p>
      <form method="post" action="${escapeHtml(retryEndpoint)}">
        <input type="hidden" name="token" value="${escapeHtml(retryToken)}">
        <button type="submit">Retry visitor ticket email</button>
      </form>
    </main>`,
  };
}

export function createVisitorStatusMessage(
  reservation,
  status,
  { ticketUrl, qrDataUrl },
  { from },
) {
  if (status !== "approved" && status !== "rejected") {
    throw new TypeError("Visitor status must be approved or rejected.");
  }

  const approved = status === "approved";
  const title = approved ? "Your farm visit is approved" : "Your farm visit request";
  const ticketContent =
    approved && ticketUrl && qrDataUrl
      ? `<p>Your entry ticket is attached below and can also be opened at <a href="${escapeHtml(ticketUrl)}">your ticket page</a>.</p><img alt="Farm visit ticket QR code" src="${escapeHtml(qrDataUrl)}">`
      : "";
  const text = [
    `Hello ${reservation.visitor_name},`,
    `Your reservation for ${reservation.farm_name} on ${reservation.visit_date} at ${reservation.time_slot_label} is ${status}.`,
    approved && ticketUrl ? `Ticket: ${ticketUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    from,
    to: reservation.visitor_email,
    subject: title,
    text,
    html: `<main>
      <h1>${title}</h1>
      <p>Hello ${escapeHtml(reservation.visitor_name)},</p>
      <p>Your reservation for ${escapeHtml(reservation.farm_name)} on ${escapeHtml(reservation.visit_date)} at ${escapeHtml(reservation.time_slot_label)} is ${status}.</p>
      ${ticketContent}
      <p>Guest count: ${escapeHtml(reservation.guest_count)}</p>
    </main>`,
  };
}
