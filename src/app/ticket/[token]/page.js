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

  return (
    <div className={styles.site}>
      <SiteHeader />
      <main className={`${styles.main} ${styles.ticket}`}>
        {ticket ? (
          <>
            <section className={styles.hero}>
              <h1>Farm visit ticket</h1>
              <p>Show this ticket when you arrive at the farm.</p>
            </section>
            <article className={styles.card}>
              <p>
                <strong>Approved</strong>
              </p>
              <dl>
                <dt>Farm</dt>
                <dd>{ticket.farmName}</dd>
                <dt>Date</dt>
                <dd>{formatManilaDate(ticket.visitDate)}</dd>
                <dt>Time</dt>
                <dd>{ticket.timeSlotLabel}</dd>
                <dt>Guests</dt>
                <dd>{ticket.guestCount}</dd>
              </dl>
            </article>
          </>
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
