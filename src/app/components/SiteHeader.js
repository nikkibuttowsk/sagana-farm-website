import Image from "next/image";
import Link from "next/link";
import "./site-header.css";
import HeaderNav from "./HeaderNav";

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

      <HeaderNav />

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