import Image from "next/image";
import { getFarmImageUrl } from "@/lib/homepage.mjs";

export default function FarmThumbnail({ farm, sizes, className }) {
  return (
    <Image
      alt={farm.name ? `${farm.name} thumbnail` : "Farm thumbnail"}
      className={className}
      fill
      sizes={sizes}
      src={getFarmImageUrl(farm)}
      unoptimized
    />
  );
}
