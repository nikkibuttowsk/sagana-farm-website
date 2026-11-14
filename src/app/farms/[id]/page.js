import { connection } from "next/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import FarmChatBox from "../../components/FarmChatBox";
import SetupNotice from "../../components/SetupNotice";
import SiteHeader from "../../components/SiteHeader";
import { ServerConfigurationError } from "@/lib/config/env.mjs";
import {
  formatFarmDetailValue,
  getFarmImageUrls,
  getFarmVideoUrl,
} from "@/lib/homepage.mjs";
import { getActiveFarmById } from "@/lib/reservations/repository.mjs";
import { createPublicSupabaseClient } from "@/lib/supabase/clients.mjs";
import pageStyles from "../../reservation/reservation.module.css";
import styles from "../../farm/farm-listing.module.css";

export const instant = false;

export const metadata = {
  title: "Farm details | Sagana Farm",
  description: "Explore a Sagana Farm location and its visitor information.",
};

const farmDetailFields = [
  ["Location", "location"],
  ["Province", "province"],
  ["Season", "season"],
  ["Bearing season", "bearing_season"],
  ["Crops", "crops"],
  ["Hours", "hours"],
  ["Entrance fee", "entrance_fee"],
  ["Activities", "activities"],
  ["Description", "description"],
];

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

  const videoUrl = getFarmVideoUrl(farm.video_url);
  const imageUrls = getFarmImageUrls(farm);

  return (
    <div className={pageStyles.site}>
      <SiteHeader />
      <main className={pageStyles.main}>
        <Link className={styles.backLink} href="/farm">
          &larr; Back to farms
        </Link>
        <div className={styles.detailLayout}>
          <section className={styles.detailVisuals} aria-label="Farm visuals">
            <h1 className={styles.detailTitle}>{farm.name}</h1>
            {videoUrl && (
              <section className={styles.mediaSection} aria-labelledby="farm-video-heading">
                <h2 className={styles.panelTitle} id="farm-video-heading">
                  Farm walkthrough
                </h2>
                <video className={styles.video} controls preload="metadata">
                  <source src={videoUrl} />
                  Your browser does not support the video element.
                </video>
              </section>
            )}
            <section className={styles.mediaSection} aria-labelledby="farm-gallery-heading">
              <h2 className={styles.panelTitle} id="farm-gallery-heading">
                Photo gallery
              </h2>
              {imageUrls.length > 0 ? (
                <div className={styles.gallery}>
                  {imageUrls.map((imageUrl, index) => (
                    <div className={styles.galleryItem} key={`${imageUrl}-${index}`}>
                      <Image
                        alt={`${farm.name} photo ${index + 1}`}
                        className={styles.galleryImage}
                        fill
                        sizes="(max-width: 40rem) 100vw, (max-width: 52rem) 50vw, 40vw"
                        src={imageUrl}
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyGallery}>No farm photos are available yet.</p>
              )}
            </section>
          </section>
          <aside
            className={styles.detailSidebar}
            aria-label={`${farm.name} visit information`}
          >
            <section className={styles.detailsPanel} aria-labelledby="farm-details-heading">
              <h2 className={styles.panelTitle} id="farm-details-heading">
                Farm details
              </h2>
              <dl className={styles.farmDetails}>
                {farmDetailFields.map(([label, field]) => {
                  const value = formatFarmDetailValue(farm[field]);

                  return (
                    <div key={field}>
                      <dt>{label}</dt>
                      <dd>{value || "Not provided"}</dd>
                    </div>
                  );
                })}
              </dl>
            </section>
            <Link
              className={styles.reservationButton}
              href={`/reservation?farmId=${encodeURIComponent(String(farm.id))}`}
            >
              Reserve this farm
            </Link>
            <FarmChatBox farm={farm} />
          </aside>
        </div>
      </main>
    </div>
  );
}
