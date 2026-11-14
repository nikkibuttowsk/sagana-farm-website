import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ServerConfigurationError } from "@/lib/config/env.mjs";
import { getActiveFarms } from "@/lib/reservations/repository.mjs";
import { createPublicSupabaseClient } from "@/lib/supabase/clients.mjs";
import {
  getFeaturedFarms,
  getLocatedFarms,
  getPopularFarms,
} from "@/lib/homepage.mjs";
import SetupNotice from "./components/SetupNotice";
import {
  ContactForm,
  FarmCarousel,
  FarmMap,
  PopularFarmGrid,
} from "./components/HomePageInteractions";

export const instant = false;

export const metadata = {
  title: "SAGANA: Farm PH",
  description:
    "Explore fruit farms in the Philippines and plan your next farm visit.",
};

function FarmSearch({ id }) {
  return (
    <search className="farm-search">
      <form action="/farm" method="get" role="search">
        <label htmlFor={id}>Search farms</label>
        <input
          id={id}
          name="q"
          type="search"
          placeholder="Fruit, farm name, or province"
        />
        <button type="submit">Search</button>
      </form>
    </search>
  );
}

export default async function HomePage() {
  await connection();

  let farms;
  try {
    farms = await getActiveFarms(createPublicSupabaseClient());
  } catch (error) {
    if (error instanceof ServerConfigurationError) {
      return (
        <SetupNotice>
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then
          apply the farm reservation and homepage metadata migrations.
        </SetupNotice>
      );
    }

    throw error;
  }

  const popularFarms = getPopularFarms(farms);
  const featuredFarms = getFeaturedFarms(farms);
  const locatedFarms = getLocatedFarms(farms);

  return (
    <div id="sagana-homepage">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header id="site-header">
        <Link href="/" aria-label="SAGANA: Farm PH Home">
          <Image
            id="logo"
            src="/farm-placeholder.svg"
            alt=""
            width={40}
            height={40}
            priority
          />
          <span>Fruit Farms PH</span>
        </Link>

        <nav aria-label="Main navigation">
          <ul>
            <li>
              <a href="#hero">Home</a>
            </li>
            <li>
              <a href="#about">About</a>
            </li>
            <li>
              <Link href="/farm">Farms</Link>
            </li>
            <li>
              <a href="#map-section">Map</a>
            </li>
            <li>
              <Link href="/reservation">Reservation</Link>
            </li>
            <li>
              <a href="#contact">Contact</a>
            </li>
          </ul>
        </nav>

        <FarmSearch id="site-search" />
      </header>

      <main id="main-content">
        <section id="hero">
          <div className="hero-content">
            <p className="eyebrow">SAGANA: Fruit Farms PH</p>
            <h1>Discover fresh farms near you</h1>
            <p>
              Explore top fruit farms in the Philippines and plan your perfect
              farm getaway.
            </p>
            <a href="#suggested-farms" className="btn btn-secondary">
              Explore farms
            </a>
          </div>

          <FarmSearch id="hero-site-search" />
          <FarmCarousel farms={featuredFarms} />
        </section>

        <section id="suggested-farms" className="content-section">
          <div className="section-header-flex">
            <div>
              <p className="eyebrow">From our farm community</p>
              <h2>Popular right now</h2>
            </div>
            <Link href="/farm" className="btn btn-outline btn-sm">
              Browse all farms &rarr;
            </Link>
          </div>

          <PopularFarmGrid farms={popularFarms} />

          <div className="view-all-container">
            <Link href="/farm" className="btn btn-primary btn-lg">
              Browse all farms in PH &rarr;
            </Link>
          </div>
        </section>

        <section id="reservation-cta" className="cta-banner">
          <div className="cta-container">
            <div className="cta-text">
              <p className="eyebrow">Make a day of it</p>
              <h2>Ready for your next farm adventure?</h2>
              <p>
                Reserve your visit ahead of time to plan tours, fruit picking,
                and fresh harvests.
              </p>
            </div>
            <div className="cta-action">
              <Link href="/reservation" className="btn btn-primary btn-lg">
                Book your visit now
              </Link>
            </div>
          </div>
        </section>

        <section id="map-section" className="map-container-section">
          <div className="map-header">
            <p className="eyebrow">Across the Philippines</p>
            <h2>Explore farms on the map</h2>
            <p>
              Click a pin to view farm details, active crops, and visit links.
            </p>
          </div>
          <FarmMap farms={locatedFarms} />
        </section>

        <section id="about" className="content-section about-section">
          <div className="about-copy">
            <p className="eyebrow">Rooted in local experiences</p>
            <h2>About SAGANA</h2>
            <p>
              SAGANA connects travelers and fruit lovers to authentic local
              agritourism experiences across the Philippines.
            </p>
          </div>
          <div className="team-grid">
            <article className="team-card">
              <div className="team-avatar" aria-hidden="true">
                NL
              </div>
              <h3>Nikki Limboc</h3>
              <p>Lead Developer</p>
            </article>
            <article className="team-card">
              <div className="team-avatar" aria-hidden="true">
                JM
              </div>
              <h3>Julian Carlo Magbuhat</h3>
              <p>UI/UX Designer</p>
            </article>
            <article className="team-card">
              <div className="team-avatar" aria-hidden="true">
                CM
              </div>
              <h3>Christine Nicole Miranda</h3>
              <p>Project Lead</p>
            </article>
          </div>
        </section>

        <section id="contact" className="contact-section">
          <div className="contact-grid">
            <div className="contact-info">
              <p className="eyebrow">We would love to hear from you</p>
              <h2>Get in touch</h2>
              <p>
                Have questions, feedback, or need help planning your trip? Send
                us a message and our team will get back to you.
              </p>

              <div className="contact-methods">
                <p>
                  <strong>Email:</strong>{" "}
                  <a href="mailto:sagana077@gmail.com">
                    sagana077@gmail.com
                  </a>
                </p>
                <p>
                  <strong>Location:</strong> Metro Manila &amp; Calabarzon,
                  Philippines
                </p>
                <p>
                  <strong>Operating hours:</strong> Mon - Fri, 8:00 AM - 5:00
                  PM
                </p>
              </div>

              <ContactForm />
            </div>

            <aside className="owner-cta-card">
              <div className="cta-badge">Farm owners &amp; managers</div>
              <h2>Own or manage a fruit farm?</h2>
              <p>
                Partner with SAGANA to showcase your farm, feature seasonal
                harvests, and receive online visit reservations.
              </p>
              <ul className="benefit-list">
                <li>Reach agritourists across the Philippines</li>
                <li>Online booking and email notifications</li>
                <li>Share your farm location with visitors</li>
              </ul>
              <Link
                href="/farm/register" className="btn btn-secondary btn-lg full-width">
                Register your farm now &rarr;
              </Link>
            </aside>
          </div>
        </section>
      </main>

      <footer id="site-footer">
        <nav aria-label="Footer navigation">
          <ul>
            <li>
              <a href="#about">About</a>
            </li>
            <li>
              <a href="#suggested-farms">Farms</a>
            </li>
            <li>
              <span>Privacy policy</span>
            </li>
            <li>
              <span>Terms of use</span>
            </li>
          </ul>
        </nav>
        <address>
          Contact us: <a href="mailto:sagana077@gmail.com">sagana077@gmail.com</a>
        </address>
        <p>
          <small>&copy; 2026 SAGANA: Fruit Farms PH. All rights reserved.</small>
        </p>
      </footer>
    </div>
  );
}
