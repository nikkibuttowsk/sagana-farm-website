import { connection } from "next/server";
import Link from "next/link";
import FarmThumbnail from "../components/FarmThumbnail";
import SetupNotice from "../components/SetupNotice";
import SiteHeader from "../components/SiteHeader";
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
import pageStyles from "../reservation/reservation.module.css";
import styles from "./farm-listing.module.css";

export const instant = false;

export const metadata = {
  title: "Visit our farms | Sagana Farm",
  description: "Explore Sagana Farm locations and request a visit.",
};

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
  const sections = [
    { title: "Popular", farms: getPopularFarms(visibleFarms) },
    { title: "Wet Season", farms: getWetSeasonFarms(visibleFarms) },
    { title: "Dry Season", farms: getDrySeasonFarms(visibleFarms) },
  ];

  return (
    <div className={pageStyles.site}>
      <SiteHeader />
      <main className={pageStyles.main}>
        <section className={pageStyles.hero}>
          <h1>Find your farm visit</h1>
          <p>Choose a Sagana farm and send a visit request for administrator review.</p>
        </section>
        <form className={pageStyles.form} action="/farm" method="get" role="search">
          <div className={pageStyles.field}>
            <label htmlFor="farm-search">Search farms</label>
            <input
              id="farm-search"
              name="q"
              type="search"
              placeholder="Fruit, farm name, or province"
              defaultValue={query}
            />
          </div>
          <div className={pageStyles.actions}>
            <button className={pageStyles.button} type="submit">
              Search
            </button>
            {query && <Link href="/farm">Clear search</Link>}
          </div>
        </form>
        {query && (
          <p className={pageStyles.notice}>
            Search results for <strong>{query}</strong>
          </p>
        )}
        {visibleFarms.length === 0 ? (
          <p className={pageStyles.notice}>
            {query
              ? `No farms match "${query}".`
              : "No farms are currently accepting visits."}
          </p>
        ) : (
          <>
            <NearbyFarmsSection farms={visibleFarms} radiusKm={100} />
            {sections.map((section) => (
              <section className={styles.section} key={section.title}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                {section.farms.length === 0 ? (
                  <p className={pageStyles.notice}>
                    No farms are currently listed in this category.
                  </p>
                ) : (
                  <div className={styles.grid}>
                    {section.farms.map((farm) => (
                      <article className={styles.card} key={farm.id}>
                        <Link
                          className={styles.cardLink}
                          href={`/farms/${encodeURIComponent(String(farm.id))}`}
                        >
                          <div className={styles.thumbnail}>
                            <FarmThumbnail
                              className={styles.image}
                              farm={farm}
                              sizes="(max-width: 40rem) 100vw, (max-width: 70rem) 50vw, 33vw"
                            />
                          </div>
                          <div className={styles.cardContent}>
                            <h3>{farm.name}</h3>
                            <p>{farm.location || "Location not provided"}</p>
                            <p>{farm.province || "Province not provided"}</p>
                            <p>{farm.season || "Season not specified"}</p>
                          </div>
                        </Link>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
}