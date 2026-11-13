import SiteHeader from "../../components/SiteHeader";
import styles from "../reservation.module.css";

export const instant = false;

export const metadata = {
  title: "Review reservation | Sagana Farm",
  robots: { index: false, follow: false },
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export default async function ReservationActionPage({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";

  return (
    <div className={styles.site}>
      <SiteHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Review visit request</h1>
          <p>
            Check the request details in the notification email before choosing
            an action. This page does not change the reservation until you
            submit.
          </p>
        </section>
        {TOKEN_PATTERN.test(token) ? (
          <div className={styles.actions}>
            <form action="/api/reservation-action" method="post">
              <input type="hidden" name="token" value={token} />
              <button
                className={styles.button}
                name="decision"
                value="approve"
                type="submit"
              >
                Approve request
              </button>
            </form>
            <form action="/api/reservation-action" method="post">
              <input type="hidden" name="token" value={token} />
              <button
                className={`${styles.button} ${styles.secondaryButton}`}
                name="decision"
                value="reject"
                type="submit"
              >
                Reject request
              </button>
            </form>
          </div>
        ) : (
          <p className={`${styles.notice} ${styles.error}`} role="alert">
            This reservation action link is invalid or unavailable.
          </p>
        )}
      </main>
    </div>
  );
}
