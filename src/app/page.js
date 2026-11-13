import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <nav aria-label="Main navigation">
            <ul>
                <li><a href="#hero">Home</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="/farm">Farms</a></li>
                <li><a href="#map-section">Map</a></li>
                <li><a href="pages/reservation.html">Reservation</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
      </main>
    </div>
  );
}
