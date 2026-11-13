import styles from "../reservation/reservation.module.css";

export default function SetupNotice({ children }) {
  return (
    <main className={styles.site}>
      <section className={`${styles.notice} ${styles.error}`} role="alert">
        <h1>Reservation service setup required</h1>
        <p>{children}</p>
      </section>
    </main>
  );
}
