import Image from "next/image";
import Link from "next/link";
import "./site-header.css";

export default function SiteHeader() {
  return (
    <header id="site-header">
      <Link href="/" aria-label="SAGANA: Farm PH Home">
        <Image
          id="logo"
          src="/images/sagana-logo.jpg"
          alt=""
          width={50}
          height={50}
          priority
        />
        <span>SAGANA</span>
      </Link>

      <nav aria-label="Main navigation">
        <ul>
          <li><Link href="/#hero">Home</Link></li>
          <li><Link href="/#about">About</Link></li>
          <li><Link href="/farm">Farms</Link></li>
          <li><Link href="/#map-section">Map</Link></li>
          <li><Link href="/reservation">Reservation</Link></li>
          <li><Link href="/#contact">Contact Us</Link></li>
        </ul>
      </nav>

      <search>
        <form action="/farm" method="get" role="search">
          <label htmlFor="site-search">Search farms</label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Fruit, farm name, or province"
          />
          <button type="submit">Search</button>
        </form>
      </search>
    </header>
  );
}