import Image from "next/image";
import Link from "next/link";
import styles from "../reservation/reservation.module.css";

export default function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/" aria-label="SAGANA: Farm PH Home">
        <Image
          className={styles.brandLogo}
          src="/farm-placeholder.svg"
          alt=""
          width={36}
          height={36}
          priority
        />
        <span>Fruit Farms PH</span>
      </Link>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/#hero">Home</Link>
        <Link href="/#about">About</Link>
        <Link href="/farm">Farms</Link>
        <Link href="/#map-section">Map</Link>
        <Link href="/reservation">Reservation</Link>
        <Link href="/#contact">Contact</Link>
      </nav>
    </header>
  );
}