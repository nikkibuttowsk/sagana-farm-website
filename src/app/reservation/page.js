import { connection } from "next/server";
import SetupNotice from "../components/SetupNotice";
import SiteHeader from "../components/SiteHeader";
import { ServerConfigurationError } from "@/lib/config/env.mjs";
import { buildFarmCatalogView } from "@/lib/reservations/views.mjs";
import {
  getActiveFarms,
  getActiveTimeSlots,
} from "@/lib/reservations/repository.mjs";
import { createPublicSupabaseClient } from "@/lib/supabase/clients.mjs";
import ReservationForm from "./ReservationForm";
import styles from "./reservation.module.css";

export const instant = false;

export const metadata = {
  title: "Reserve a farm visit | Sagana Farm",
  description: "Request a visit to a Sagana farm.",
};

function getManilaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function ReservationPage({ searchParams }) {
  await connection();
  const params = await searchParams;
  let farms;
  let slotsByFarm;

  try {
    const client = createPublicSupabaseClient();
    farms = await getActiveFarms(client);
    const slotEntries = await Promise.all(
      farms.map(async (farm) => [
        farm.id,
        await getActiveTimeSlots(client, farm.id),
      ]),
    );
    slotsByFarm = Object.fromEntries(slotEntries);
  } catch (error) {
    if (error instanceof ServerConfigurationError) {
      return (
        <SetupNotice>
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then
          apply the farm reservation migration.
        </SetupNotice>
      );
    }

    throw error;
  }

  const catalog = buildFarmCatalogView(farms, slotsByFarm);

  return (
    <div className={styles.site}>
      <SiteHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Request a farm visit</h1>
          <p>
            Choose a farm, date, and time. Your request is confirmed after the
            farm administrator reviews availability.
          </p>
        </section>
        <ReservationForm
          farms={catalog}
          initialFarmId={params?.farmId ?? ""}
          minDate={getManilaToday()}
        />
      </main>
    </div>
  );
}
