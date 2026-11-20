```javascript
import SiteHeader from "../../components/SiteHeader";
import { buildTicketEmailRetryMessage } from "@/lib/reservations/views.mjs";
import styles from "../reservation.module.css";

export const instant = false;

export const metadata = {
  title: "Resend visit ticket | Sagana Farm",
  robots: { index: false, follow: false },
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export default async function TicketEmailPage({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";
  const status =
    typeof params?.status === "string" ? params.status : undefined;
  const retryMessage = buildTicketEmailRetryMessage(status);

  return (
    <div className={styles.site}>
      <SiteHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Resend your visit ticket</h1>
          <p>
            If your visit was approved, submit this form to send a new ticket
            email.
          </p>
        </section>
        {retryMessage && (
          <p
            className={`${styles.notice} ${status === "sent" ? "" : styles.error}`}
            role={status === "sent" ? "status" : "alert"}
          >
            {retryMessage}
          </p>
        )}
        {TOKEN_PATTERN.test(token) ? (
          <form action="/api/ticket-email-retry" method="post">
            <input type="hidden" name="token" value={token} />
            <button className={styles.button} type="submit">
              Send ticket email
            </button>
          </form>
        ) : (
          <p className={`${styles.notice} ${styles.error}`} role="alert">
            This retry link is invalid or unavailable.
          </p>
        )}
      </main>
    </div>
  );
}
