import { connection } from "next/server";
import Link from "next/link";
import SetupNotice from "../components/SetupNotice";
import SiteHeader from "../components/SiteHeader";
import { ServerConfigurationError } from "@/lib/config/env.mjs";
import { filterFarmsByQuery } from "@/lib/homepage.mjs";
import { getActiveFarms } from "@/lib/reservations/repository.mjs";
import { createPublicSupabaseClient } from "@/lib/supabase/clients.mjs";
import styles from "../reservation/reservation.module.css";

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

  return (
    <div className={styles.site}>
      <SiteHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Find your farm visit</h1>
          <p>Choose a Sagana farm and send a visit request for administrator review.</p>
        </section>
        <form className={styles.form} action="/farm" method="get" role="search">
          <div className={styles.field}>
            <label htmlFor="farm-search">Search farms</label>
            <input
              id="farm-search"
              name="q"
              type="search"
              placeholder="Fruit, farm name, or province"
              defaultValue={query}
            />
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit">
              Search
            </button>
            {query && <Link href="/farm">Clear search</Link>}
          </div>
        </form>
        {query && (
          <p className={styles.notice}>
            Search results for <strong>{query}</strong>
          </p>
        )}
        {visibleFarms.length === 0 ? (
          <p className={styles.notice}>
            {query
              ? `No farms match "${query}".`
              : "No farms are currently accepting visits."}
          </p>
        ) : (
          <div className={styles.grid}>
            {visibleFarms.map((farm) => (
              <article className={styles.card} key={farm.id}>
                <h2>{farm.name}</h2>
                {farm.location && <p>{farm.location}</p>}
                {farm.description && <p>{farm.description}</p>}
                <Link
                  className={styles.button}
                  href={`/reservation?farmId=${encodeURIComponent(farm.id)}`}
                >
                  Reserve a visit
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
