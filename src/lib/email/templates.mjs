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

function wrapEmailLayout({ eyebrow, title, subtitle, bodyHtml, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:24px 12px;background-color:#f4f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2e23;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #dfe6dc;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="background-color:#173d2b;padding:28px 28px 24px;color:#ffffff;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#b7d7b6;">
          ${escapeHtml(eyebrow)}
        </p>
        <h1 style="margin:0 0 6px;font-size:22px;line-height:1.25;font-weight:700;color:#ffffff;">
          ${escapeHtml(title)}
        </h1>
        ${
          subtitle
            ? `<p style="margin:0;font-size:14px;line-height:1.45;color:#d6e6d5;">${escapeHtml(subtitle)}</p>`
            : ""
        }
      </td>
    </tr>
    <tr>
      <td style="padding:26px 28px;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px 22px;background-color:#f8faf7;border-top:1px solid #edf2eb;font-size:12px;line-height:1.5;color:#6b7a6e;">
        ${footerNote}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderDetailsTable(rows) {
  const cells = rows
    .map(
      ([label, value], index) => `
      <tr>
        <td style="padding:10px 0;${index < rows.length - 1 ? "border-bottom:1px solid #edf2eb;" : ""}font-size:13px;color:#6b7a6e;width:36%;">
          ${escapeHtml(label)}
        </td>
        <td style="padding:10px 0;${index < rows.length - 1 ? "border-bottom:1px solid #edf2eb;" : ""}font-size:14px;font-weight:600;color:#102d20;text-align:right;">
          ${escapeHtml(value)}
        </td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 20px;padding:4px 16px;background-color:#f8faf7;border:1px solid #e3ebe1;border-radius:12px;">
    ${cells}
  </table>`;
}

export function createAdminReservationMessage(
  reservation,
  { actionUrl, retryUrl, from, to },
) {
  const details = reservationDetails(reservation);

  const bodyHtml = `
    <p style="margin:0 0 4px;font-size:15px;line-height:1.5;color:#1f2e23;">
      A new farm visit request has been submitted and is waiting for your review.
    </p>
    ${renderDetailsTable([
      ["Farm", reservation.farm_name],
      ["Visitor", reservation.visitor_name],
      ["Email", reservation.visitor_email],
      ["Phone", reservation.visitor_phone],
      ["Visit Date", reservation.visit_date],
      ["Time Slot", reservation.time_slot_label],
      ["Guests", `${reservation.guest_count} ${Number(reservation.guest_count) === 1 ? "guest" : "guests"}`],
    ])}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;width:100%;box-sizing:border-box;padding:13px 20px;background-color:#173d2b;color:#ffffff;font-size:14px;font-weight:700;text-align:center;text-decoration:none;border-radius:10px;">
            Review &amp; Approve or Reject Request &rarr;
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b7a6e;text-align:center;">
      Already approved, but the visitor didn&rsquo;t receive their ticket?
      <a href="${escapeHtml(retryUrl)}" style="color:#39744c;font-weight:600;text-decoration:underline;">Resend visitor ticket email</a>
    </p>
  `;

  return {
    from,
    to,
    subject: `New visit request: ${reservation.farm_name} (${reservation.visit_date})`,
    text: `${details}\n\nReview and decide: ${actionUrl}\nRetry visitor ticket email: ${retryUrl}`,
    html: wrapEmailLayout({
      eyebrow: "SAGANA ADMIN • NEW REQUEST",
      title: "Farm visit reservation request",
      subtitle: `${reservation.farm_name} • ${reservation.visit_date}`,
      bodyHtml,
      footerNote:
        "This approval link is single-use and expires automatically. No changes are made until you confirm on the review page.",
    }),
  };
}

export function createVisitorPendingMessage(reservation, { from }) {
  const title = `We received your visit request for ${reservation.farm_name}`;
  const text = [
    `Hello ${reservation.visitor_name},`,
    `Thank you for requesting a visit to ${reservation.farm_name} on ${reservation.visit_date} at ${reservation.time_slot_label} (${reservation.guest_count} guest(s)).`,
    `Reference ID: ${reservation.id}`,
    `Status: Pending Administrator Review`,
    `You will receive another email with your official QR entry pass once the farm administrator approves your visit.`,
  ].join("\n\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#1f2e23;">
      Hi <strong>${escapeHtml(reservation.visitor_name)}</strong>,
    </p>
    <p style="margin:0 0 6px;font-size:14px;line-height:1.55;color:#4a5a4e;">
      Thank you for booking with SAGANA! Your visit request has been sent to <strong>${escapeHtml(reservation.farm_name)}</strong> and is currently <strong>pending administrator review</strong>.
    </p>
    ${renderDetailsTable([
      ["Reference ID", reservation.id],
      ["Farm", reservation.farm_name],
      ["Visit Date", reservation.visit_date],
      ["Time Slot", reservation.time_slot_label],
      ["Guests", `${reservation.guest_count} ${Number(reservation.guest_count) === 1 ? "guest" : "guests"}`],
      ["Status", "Pending Review"],
    ])}
    <div style="padding:14px 16px;background-color:#e8f2e4;border-radius:10px;font-size:13px;line-height:1.5;color:#173d2b;">
      <strong>What happens next?</strong> Once the farm confirms slot availability, we will email your official digital ticket and QR check-in pass to this address.
    </div>
  `;

  return {
    from,
    to: reservation.visitor_email,
    subject: title,
    text,
    html: wrapEmailLayout({
      eyebrow: "SAGANA • REQUEST RECEIVED",
      title: "Your visit request is in review",
      subtitle: reservation.farm_name,
      bodyHtml,
      footerNote:
        "Please keep your Reference ID handy if you need to follow up with the farm.",
    }),
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
  const subject = approved
    ? `Visit Approved! Your QR Ticket for ${reservation.farm_name}`
    : `Update on your visit request for ${reservation.farm_name}`;

  const text = [
    `Hello ${reservation.visitor_name},`,
    `Your reservation for ${reservation.farm_name} on ${reservation.visit_date} at ${reservation.time_slot_label} is ${status}.`,
    approved && ticketUrl ? `Ticket: ${ticketUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const bodyHtml = approved
    ? `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#1f2e23;">
        Hi <strong>${escapeHtml(reservation.visitor_name)}</strong>,
      </p>
      <p style="margin:0 0 6px;font-size:14px;line-height:1.55;color:#4a5a4e;">
        Great news! Your farm visit has been <strong>approved</strong>. Present this QR code or open your digital pass at the farm gate upon arrival.
      </p>
      ${renderDetailsTable([
        ["Farm", reservation.farm_name],
        ["Visit Date", reservation.visit_date],
        ["Time Slot", reservation.time_slot_label],
        ["Guests", `${reservation.guest_count} ${Number(reservation.guest_count) === 1 ? "guest" : "guests"}`],
        ["Status", "Approved"],
      ])}
      ${
        qrDataUrl
          ? `<div style="margin:18px 0;padding:20px;background-color:#f8faf7;border:1.5px dashed #c6d4c7;border-radius:12px;text-align:center;">
              <img alt="Farm visit ticket QR code" src="${escapeHtml(qrDataUrl)}" width="180" height="180" style="display:block;margin:0 auto 10px;border-radius:8px;" />
              <p style="margin:0;font-size:12px;color:#5c6b5f;">Scan at the farm entrance for quick check-in</p>
            </div>`
          : ""
      }
      ${
        ticketUrl
          ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(ticketUrl)}" style="display:inline-block;width:100%;box-sizing:border-box;padding:13px 20px;background-color:#173d2b;color:#ffffff;font-size:14px;font-weight:700;text-align:center;text-decoration:none;border-radius:10px;">
                    Open Digital Arrival Pass &rarr;
                  </a>
                </td>
              </tr>
            </table>`
          : ""
      }
    `
    : `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#1f2e23;">
        Hi <strong>${escapeHtml(reservation.visitor_name)}</strong>,
      </p>
      <p style="margin:0 0 6px;font-size:14px;line-height:1.55;color:#4a5a4e;">
        Unfortunately, <strong>${escapeHtml(reservation.farm_name)}</strong> is unable to accommodate your visit request for the selected date and time.
      </p>
      ${renderDetailsTable([
        ["Farm", reservation.farm_name],
        ["Requested Date", reservation.visit_date],
        ["Time Slot", reservation.time_slot_label],
        ["Guests", `${reservation.guest_count} ${Number(reservation.guest_count) === 1 ? "guest" : "guests"}`],
        ["Status", "Declined"],
      ])}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#5c6b5f;">
        You are welcome to submit a new reservation request for another available date or time slot on SAGANA.
      </p>
    `;

  return {
    from,
    to: reservation.visitor_email,
    subject,
    text,
    html: wrapEmailLayout({
      eyebrow: approved ? "SAGANA • VISIT CONFIRMED" : "SAGANA • RESERVATION UPDATE",
      title: approved ? "See you at the farm!" : "Visit request update",
      subtitle: reservation.farm_name,
      bodyHtml,
      footerNote: approved
        ? "Need to change your plans? Contact the farm directly using the details on SAGANA."
        : "Thank you for supporting local Philippine fruit farms with SAGANA.",
    }),
  };
}