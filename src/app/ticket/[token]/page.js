import { connection } from "next/server";
import Link from "next/link";
import SetupNotice from "../../components/SetupNotice";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import TicketCard from "../../reservation/TicketCard";
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
      <main className={styles.main}>
        {ticket ? (
          <div className={styles.confirmWrap}>
            <header className={styles.confirmHeader}>
              <span className={styles.confirmPill}>
                ✓ Approved &bull; Official Pass
              </span>
              <h1>Farm visit ticket</h1>
              <p>Present this digital pass when you arrive at the farm.</p>
            </header>

            <TicketCard
              farmName={ticket.farmName}
              location={ticket.farmLocation}
              imageUrl={ticket.farmImageUrl}
              dateLabel={formatManilaDate(ticket.visitDate)}
              slotLabel={ticket.timeSlotLabel}
              visitors={`${ticket.guestCount} ${
                Number(ticket.guestCount) === 1 ? "guest" : "guests"
              }`}
              bookedFor={ticket.visitorName}
              qrDataUrl={qrUrl}
              caption="Scan at the farm gate for check-in"
            />

            <div className={styles.confirmFooter}>
              <div className={styles.emailBox}>
                <span aria-hidden="true">✉️</span>
                <div>
                  <strong>Keep this page handy</strong>
                  <span>Show the QR code to the farm team at the gate</span>
                </div>
              </div>
              <div className={styles.confirmActions}>
                <Link href="/farm" className={styles.backFarmBtn}>
                  Back to Farm &larr;
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <section className={styles.notice} role="status">
            This ticket is unavailable. It may be invalid, expired, or not
            approved.
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}