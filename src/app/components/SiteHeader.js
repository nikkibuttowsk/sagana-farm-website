import Link from "next/link";
import styles from "../reservation/reservation.module.css";

export default function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/">
        Sagana Farm
      </Link>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/farm">Farms</Link>
        <Link href="/reservation">Reserve a visit</Link>
      </nav>
    </header>
  );
}
