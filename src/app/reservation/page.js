import { connection } from "next/server";
import SetupNotice from "../components/SetupNotice";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import { ServerConfigurationError } from "@/lib/config/env.mjs";
import { buildFarmCatalogView } from "@/lib/reservations/views.mjs";
import {
  getActiveFarms,
  getActiveTimeSlots,
} from "@/lib/reservations/repository.mjs";
import {
  createAdminSupabaseClient,
  createPublicSupabaseClient,
} from "@/lib/supabase/clients.mjs";
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

const DEFAULT_SLOT_TEMPLATES = [
  { label: "08:00 - 10:00", sort_order: 1 },
  { label: "10:00 - 12:00", sort_order: 2 },
  { label: "13:00 - 15:00", sort_order: 3 },
  { label: "15:00 - 17:00", sort_order: 4 },
];

async function ensureFarmTimeSlots(publicClient, farm) {
  const existing = await getActiveTimeSlots(publicClient, farm.id);
  if (existing.length > 0) {
    return existing;
  }

  try {
    const adminClient = createAdminSupabaseClient();
    const rows = DEFAULT_SLOT_TEMPLATES.map((slot) => ({
      farm_id: farm.id,
      label: slot.label,
      sort_order: slot.sort_order,
      is_active: true,
    }));

    const { error } = await adminClient.from("farm_time_slots").insert(rows);
    if (!error) {
      return await getActiveTimeSlots(publicClient, farm.id);
    }
    console.error("Could not auto-seed farm_time_slots:", error);
  } catch (err) {
    console.error("Admin client unavailable for auto-seeding time slots:", err);
  }

  return existing;
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
        await ensureFarmTimeSlots(client, farm),
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
  const rawFarmMap = Object.fromEntries(farms.map((f) => [f.id, f]));
  const enrichedCatalog = catalog.map((item) => ({
    ...item,
    location:
      rawFarmMap[item.id]?.location ||
      rawFarmMap[item.id]?.province ||
      "Philippines",
    imageUrl: Array.isArray(rawFarmMap[item.id]?.images)
      ? rawFarmMap[item.id].images[0]
      : typeof rawFarmMap[item.id]?.images === "string" &&
          rawFarmMap[item.id].images.trim()
        ? rawFarmMap[item.id].images.trim()
        : "/farm-placeholder.svg",
  }));

  return (
    <div className={styles.site}>
      <SiteHeader />
      <main className={styles.main}>
        <ReservationForm
          key={`${params?.farmId ?? "default"}-${crypto.randomUUID()}`}
          farms={enrichedCatalog}
          initialFarmId={params?.farmId ?? ""}
          minDate={getManilaToday()}
        />
      </main>
      <SiteFooter />
    </div>
  );
}