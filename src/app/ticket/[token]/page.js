import { connection } from "next/server";
import SetupNotice from "../../components/SetupNotice";
import SiteHeader from "../../components/SiteHeader";
import { ServerConfigurationError } from "@/lib/config/env.mjs";
import { getApprovedTicket } from "@/lib/reservations/repository.mjs";
import { buildTicketView } from "@/lib/reservations/views.mjs";
import { createAdminSupabaseClient } from "@/lib/supabase/clients.mjs";
import styles from "../../reservation/reservation.module.css";

export const instant = false;

export const metadata = {
  title: "Farm visit ticket | Sagana Farm",
  robots: { index: false, follow: false },
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function formatManilaDate(value) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "full",
    timeZone: "Asia/Manila",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

export default async function TicketPage({ params }) {
  await connection();
  const { token } = await params;
  let ticket = null;

  if (TOKEN_PATTERN.test(token)) {
    try {
      ticket = buildTicketView(
        await getApprovedTicket(token, createAdminSupabaseClient()),
      );
    } catch (error) {
      if (error instanceof ServerConfigurationError) {
        return (
          <SetupNotice>
            Configure the server-side Supabase URL and service-role key to
            validate farm visit tickets.
          </SetupNotice>
        );
      }

      throw error;
    }
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(token)}`;

  return (
    <div className={styles.site}>
      <SiteHeader />
      <main className={`${styles.main} ${styles.ticket}`}>
        {ticket ? (
          <div className={styles.wrapper}>
            <header className={`${styles.stepHeader} ${styles.centerHeader}`}>
              <span className={styles.statusPill}>Approved &bull; Official Pass</span>
              <h1>Farm visit ticket</h1>
              <p>Present this digital pass when you arrive at the farm.</p>
            </header>

            <article className={styles.card}>
              <div style={{ textAlign: "center", padding: "0.75rem 0 1.25rem" }}>
                <img
                  src={qrUrl}
                  alt="Farm visit check-in QR code"
                  width={190}
                  height={190}
                  style={{
                    display: "inline-block",
                    borderRadius: "0.75rem",
                    border: "1px solid #dfe6dc",
                    padding: "0.5rem",
                    background: "#ffffff",
                  }}
                />
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "#5c6b5f" }}>
                  Scan at the farm gate for check-in
                </p>
              </div>

              <div className={styles.ticketDetails}>
                <div className={styles.ticketRow}>
                  <span>Farm</span>
                  <strong>{ticket.farmName}</strong>
                </div>
                <div className={styles.ticketRow}>
                  <span>Date</span>
                  <strong>{formatManilaDate(ticket.visitDate)}</strong>
                </div>
                <div className={styles.ticketRow}>
                  <span>Time</span>
                  <strong>{ticket.timeSlotLabel}</strong>
                </div>
                <div className={styles.ticketRow}>
                  <span>Guests</span>
                  <strong>{ticket.guestCount}</strong>
                </div>
              </div>
            </article>
          </div>
        ) : (
          <section className={styles.notice} role="status">
            This ticket is unavailable. It may be invalid, expired, or not
            approved.
          </section>
        )}
      </main>
    </div>
  );
}