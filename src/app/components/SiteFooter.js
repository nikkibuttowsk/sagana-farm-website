import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer id="site-footer">
      <nav aria-label="Footer navigation">
        <ul>
          <li><Link href="/#hero">Home</Link></li>
          <li><Link href="/#about">About</Link></li>
          <li><Link href="/farm">Farms</Link></li>
          <li><Link href="/#map-section">Map</Link></li>
          <li><Link href="/reservation">Reservation</Link></li>
          <li><Link href="/#contact">Contact Us</Link></li>
        </ul>
        <ul>
          <li><span>Privacy policy</span></li>
          <li><span>Terms of use</span></li>
        </ul>
      </nav>
      <address>
        Contact us: <a href="mailto:sagana077@gmail.com">sagana077@gmail.com</a>
      </address>
      <p>
        <small>&copy; 2026 SAGANA: Fruit Farms PH. All rights reserved.</small>
      </p>
    </footer>
  );
}