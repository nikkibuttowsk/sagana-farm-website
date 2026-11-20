import { connection } from "next/server";
import Link from "next/link";
import FarmThumbnail from "../components/FarmThumbnail";
import SetupNotice from "../components/SetupNotice";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import NearbyFarmsSection from "../components/NearbyFarmsSection";
import { ServerConfigurationError } from "@/lib/config/env.mjs";
import {
  filterFarmsByQuery,
  getDrySeasonFarms,
  getPopularFarms,
  getWetSeasonFarms,
} from "@/lib/homepage.mjs";
import { getActiveFarms } from "@/lib/reservations/repository.mjs";
import { createPublicSupabaseClient } from "@/lib/supabase/clients.mjs";
import "./farm-list.css";

export const instant = false;

export const metadata = {
  title: "Browse All Farms | SAGANA",
  description: "Explore Sagana Farm locations and request a visit.",
};

function cropsText(farm) {
  if (Array.isArray(farm.crops)) return farm.crops.join(", ");
  return typeof farm.crops === "string" ? farm.crops : "";
}

function FarmCard({ farm }) {
  return (
    <article className="farm-card">
      <Link href={`/farms/${encodeURIComponent(String(farm.id))}`}>
        <div className="card-media">
          <FarmThumbnail
            farm={farm}
            sizes="(max-width: 40rem) 100vw, (max-width: 70rem) 33vw, 25vw"
          />
        </div>
        <div className="card-info">
          <h3>{farm.name}</h3>
          <p className="location">{farm.location || farm.province || "Location not provided"}</p>
          <span className="tag">{cropsText(farm) || "Fresh Produce"}</span>
        </div>
      </Link>
    </article>
  );
}

export default async function FarmPage({ searchParams }) {
  await connection();

  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q.trim() : "";
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

  const visibleFarms = filterFarmsByQuery(farms, query);
  const popular = getPopularFarms(visibleFarms);
  const wet = getWetSeasonFarms(visibleFarms);
  const dry = getDrySeasonFarms(visibleFarms);

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="farm-list-container">
        <header className="page-title-banner">
          <h1>Explore Fruit Farms</h1>
          <p>
            Find harvest locations across the Philippines best suited for your
            schedule and season.
          </p>
          {query && (
            <p className="search-note">
              Search results for <strong>{query}</strong>
              <Link href="/farm">Clear search</Link>
            </p>
          )}
        </header>

        {visibleFarms.length === 0 ? (
          <section className="farm-group-section">
            <p className="empty-row">
              {query ? `No farms match "${query}".` : "No farms are currently accepting visits."}
            </p>
          </section>
        ) : (
          <>
            {/* NEARBY */}
            <section className="farm-group-section">
              <NearbyFarmsSection farms={visibleFarms} radiusKm={20} />
            </section>

            {/* POPULAR */}
            <section className="farm-group-section band">
              <div className="section-header">
                <h2>🔥 Popular Right Now</h2>
              </div>
              {popular.length === 0 ? (
                <p className="empty-row">No farms found.</p>
              ) : (
                <div className="farm-grid">
                  {popular.map((farm) => <FarmCard key={farm.id} farm={farm} />)}
                </div>
              )}
            </section>

            {/* WET SEASON */}
            <section className="farm-group-section">
              <div className="section-header">
                <h2>🌧️ Best for Wet Season (June – November)</h2>
                <p className="section-sub">
                  Farms featuring rain-resilient fruits like Durian, Rambutan, and Lanzones.
                </p>
              </div>
              {wet.length === 0 ? (
                <p className="empty-row">No farms found.</p>
              ) : (
                <div className="season-row">
                  {wet.map((farm) => <FarmCard key={farm.id} farm={farm} />)}
                </div>
              )}
            </section>

            {/* DRY SEASON */}
            <section className="farm-group-section">
              <div className="section-header">
                <h2>☀️ Best for Dry Season (December – May)</h2>
                <p className="section-sub">
                  Peak harvest season for Mangoes, Strawberries, Watermelons, and Pineapples.
                </p>
              </div>
              {dry.length === 0 ? (
                <p className="empty-row">No farms found.</p>
              ) : (
                <div className="season-row">
                  {dry.map((farm) => <FarmCard key={farm.id} farm={farm} />)}
                </div>
              )}
            </section>

            {/* ALL FARMS (CATCH-ALL FOR UNCATEGORIZED & YEAR-ROUND FARMS) */}
            <section className="farm-group-section band">
              <div className="section-header">
                <h2>🌱 Explore All Farms ({visibleFarms.length})</h2>
                <p className="section-sub">
                  Browse every active partner farm across the Philippines, including year-round and newly added destinations.
                </p>
              </div>
              <div className="farm-grid">
                {visibleFarms.map((farm) => <FarmCard key={farm.id} farm={farm} />)}
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}