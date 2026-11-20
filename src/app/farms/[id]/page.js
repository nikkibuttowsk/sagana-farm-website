import { connection } from "next/server";
import { notFound } from "next/navigation";
import SetupNotice from "../../components/SetupNotice";
import SiteHeader from "../../components/SiteHeader";
import { ServerConfigurationError } from "@/lib/config/env.mjs";
import { getFarmImageUrls, getFarmVideoUrl } from "@/lib/homepage.mjs";
import {
  getActiveFarmById,
  getActiveFarms,
} from "@/lib/reservations/repository.mjs";
import { createPublicSupabaseClient } from "@/lib/supabase/clients.mjs";
import FarmPopup from "./FarmPopup";
import "./farm-detail.css";

export const instant = false;

export const metadata = {
  title: "Farm details | Sagana Farm",
  description: "Explore a Sagana Farm location and its visitor information.",
};

// turns an array or a "a, b, c" string into a clean array
function toList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function FarmDetailsPage({ params }) {
  await connection();

  const { id } = await params;
  let farm;
  let allFarms = [];

  try {
    const supabase = createPublicSupabaseClient();
    farm = await getActiveFarmById(supabase, id);
    allFarms = await getActiveFarms(supabase);
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

  if (!farm) notFound();

  const index = allFarms.findIndex((f) => String(f.id) === String(farm.id));
  const prevId =
    allFarms.length > 1
      ? allFarms[(index - 1 + allFarms.length) % allFarms.length].id
      : null;
  const nextId =
    allFarms.length > 1 ? allFarms[(index + 1) % allFarms.length].id : null;

  // only plain data goes to the client component
  const farmData = {
    id: String(farm.id),
    name: farm.name || "",
    location: farm.location || "",
    province: farm.province || "",
    description: typeof farm.description === "string" ? farm.description : "",
    type: farm.farm_type || farm.type || "",
    rating: farm.rating ?? null,
    reviews: farm.reviews_count ?? farm.review_count ?? null,
    hours: farm.hours || "",
    crops: toList(farm.crops),
    bearingSeason: farm.bearing_season || "",
    phone: farm.phone || farm.contact_number || "",
    latitude: farm.latitude ?? null,
    longitude: farm.longitude ?? null,
    entranceFee: farm.entrance_fee ?? null,
    activities: toList(farm.activities),
  };

  return (
    <>
      <SiteHeader />
      <FarmPopup
        key={farmData.id}
        farm={farmData}
        videoUrl={getFarmVideoUrl(farm.video_url) || null}
        imageUrls={getFarmImageUrls(farm)}
        prevId={prevId ? String(prevId) : null}
        nextId={nextId ? String(nextId) : null}
      />
    </>
  );
}