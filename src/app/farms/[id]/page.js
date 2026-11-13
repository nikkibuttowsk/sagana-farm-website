import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import FarmThumbnail from "../../components/FarmThumbnail";
import SetupNotice from "../../components/SetupNotice";
import SiteHeader from "../../components/SiteHeader";
import { ServerConfigurationError } from "@/lib/config/env.mjs";
import { getActiveFarmById } from "@/lib/reservations/repository.mjs";
import { createPublicSupabaseClient } from "@/lib/supabase/clients.mjs";
import pageStyles from "../../reservation/reservation.module.css";
import styles from "../../farm/farm-listing.module.css";

export const instant = false;

export const metadata = {
  title: "Farm details | Sagana Farm",
  description: "Explore a Sagana Farm location and its visitor information.",
};

export default async function FarmDetailsPage({ params }) {
  await connection();

  const { id } = await params;
  let farm;

  try {
    farm = await getActiveFarmById(createPublicSupabaseClient(), id);
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

  if (!farm) {
    notFound();
  }

  return (
    <div className={pageStyles.site}>
      <SiteHeader />
      <main className={pageStyles.main}>
        <Link className={styles.backLink} href="/farm">
          &larr; Back to farms
        </Link>
        <article className={styles.detail}>
          <div className={styles.detailImage}>
            <FarmThumbnail
              className={styles.image}
              farm={farm}
              sizes="(max-width: 52rem) 100vw, 52rem"
            />
          </div>
          <h1 className={styles.detailTitle}>{farm.name}</h1>
          <dl className={styles.metadata}>
            <div>
              <dt>Location</dt>
              <dd>{farm.location || "Location not provided"}</dd>
            </div>
            <div>
              <dt>Province</dt>
              <dd>{farm.province || "Province not provided"}</dd>
            </div>
            <div>
              <dt>Season</dt>
              <dd>{farm.season || "Season not specified"}</dd>
            </div>
          </dl>
          {farm.description && <p>{farm.description}</p>}
        </article>
      </main>
    </div>
  );
}
