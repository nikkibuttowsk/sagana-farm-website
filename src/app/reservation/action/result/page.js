import SiteHeader from "../../../components/SiteHeader";
import { buildReservationDecisionView } from "@/lib/reservations/views.mjs";
import styles from "../../reservation.module.css";

export const instant = false;

export const metadata = {
  title: "Reservation decision | Sagana Farm",
  robots: { index: false, follow: false },
};

export default async function ReservationActionResultPage({ searchParams }) {
  const params = await searchParams;
  const status =
    typeof params?.status === "string" ? params.status : "invalid";
  const { message, emailFailed } = buildReservationDecisionView(
    status,
    params?.email,
  );

  return (
    <div className={styles.site}>
      <SiteHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Reservation decision</h1>
          <p>{message}</p>
        </section>
        {emailFailed && (
          <p className={`${styles.notice} ${styles.error}`} role="alert">
            The decision was saved, but the visitor notification email could
            not be delivered. The reservation status has not been rolled back.
          </p>
        )}
      </main>
    </div>
  );
}
