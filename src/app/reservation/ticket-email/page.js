import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import TicketCard from "../../reservation/TicketCard";
import { buildTicketEmailRetryMessage } from "@/lib/reservations/views.mjs";
import styles from "../../reservation/reservation.module.css";

export const instant = false;

export const metadata = {
  title: "Resend visit ticket | Sagana Farm",
  robots: { index: false, follow: false },
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export default async function TicketEmailPage({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";
  const status = typeof params?.status === "string" ? params.status : undefined;
  const retryMessage = buildTicketEmailRetryMessage(status);
  const validToken = TOKEN_PATTERN.test(token);

  return (
    <div className={styles.site}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.confirmWrap}>
          <header className={styles.confirmHeader}>
            <span className={styles.confirmPill}>✓ Visit ticket</span>
            <h1>Need your ticket again?</h1>
            <p>
              If your visit was approved, we can email your QR ticket once more.
              <br />
              Keep your digital ticket handy for check-in.
            </p>
          </header>

          {retryMessage && (
            <p
              className={`${styles.notice} ${status === "sent" ? "" : styles.error}`}
              role={status === "sent" ? "status" : "alert"}
            >
              {retryMessage}
            </p>
          )}

          <TicketCard caption="Ticket details are sent by email" />

          <div className={styles.confirmFooter}>
            <div className={styles.emailBox}>
              <span aria-hidden="true">✉️</span>
              <div>
                <strong>Resend your ticket</strong>
                <span>Check your inbox and spam folder</span>
              </div>
            </div>
            <div className={styles.confirmActions}>
              {validToken ? (
                <form action="/api/ticket-email-retry" method="post" style={{ width: "100%" }}>
                  <input type="hidden" name="token" value={token} />
                  <button className={styles.backFarmBtn} type="submit" style={{ border: 0, cursor: "pointer" }}>
                    Send ticket email
                  </button>
                </form>
              ) : (
                <p className={styles.invalidNote} role="alert">
                  This retry link is invalid or unavailable.
                </p>
              )}
              <Link href="/farm" className={styles.linkBtn}>
                Back to Farm
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}