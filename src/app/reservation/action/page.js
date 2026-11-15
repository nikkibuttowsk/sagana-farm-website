import { connection } from "next/server";
import SetupNotice from "../../components/SetupNotice";
import SiteHeader from "../../components/SiteHeader";
import { ServerConfigurationError } from "@/lib/config/env.mjs";
import { hashToken } from "@/lib/reservations/tokens.mjs";
import { createAdminSupabaseClient } from "@/lib/supabase/clients.mjs";
import styles from "../reservation.module.css";

export const instant = false;

export const metadata = {
  title: "Review reservation | Sagana Farm",
  robots: { index: false, follow: false },
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

async function getActionableReservation(token) {
  if (!TOKEN_PATTERN.test(token)) {
    return { state: "invalid" };
  }

  const client = createAdminSupabaseClient();
  const { data, error } = await client
    .from("reservations")
    .select(
      "id,visitor_name,visit_date,guest_count,status,admin_action_used_at,admin_action_expires_at,farm_id,time_slot_id",
    )
    .eq("admin_action_token_hash", hashToken(token))
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return { state: "invalid" };
  }

  if (data.admin_action_used_at !== null || data.status !== "pending") {
    return { state: "already_decided", reservation: data };
  }

  if (
    data.admin_action_expires_at &&
    new Date(data.admin_action_expires_at).getTime() <= Date.now()
  ) {
    return { state: "expired" };
  }

  const [{ data: farm }, { data: slot }] = await Promise.all([
    client.from("farms").select("name").eq("id", data.farm_id).maybeSingle(),
    client
      .from("farm_time_slots")
      .select("label")
      .eq("id", data.time_slot_id)
      .maybeSingle(),
  ]);

  return {
    state: "pending",
    reservation: {
      ...data,
      farm_name: farm?.name ?? "Sagana Farm",
      time_slot_label: slot?.label ?? "Scheduled Slot",
    },
  };
}

export default async function ReservationActionPage({ searchParams }) {
  await connection();
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";

  let lookup;
  try {
    lookup = await getActionableReservation(token);
  } catch (error) {
    if (error instanceof ServerConfigurationError) {
      return (
        <SetupNotice>
          Configure the server-side Supabase URL and service-role key to review
          reservations.
        </SetupNotice>
      );
    }
    throw error;
  }

  return (
    <div className={styles.site}>
      <SiteHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Review visit request</h1>
          <p>
            Confirm your decision below. Once submitted, this link is locked and
            cannot be used again.
          </p>
        </section>

        {lookup.state === "pending" && (
          <>
            <article className={styles.card} style={{ marginBottom: "1.25rem" }}>
              <div className={styles.ticketDetails}>
                <div className={styles.ticketRow}>
                  <span>Visitor</span>
                  <strong>{lookup.reservation.visitor_name}</strong>
                </div>
                <div className={styles.ticketRow}>
                  <span>Farm</span>
                  <strong>{lookup.reservation.farm_name}</strong>
                </div>
                <div className={styles.ticketRow}>
                  <span>Date &amp; Time</span>
                  <strong>
                    {lookup.reservation.visit_date} &bull;{" "}
                    {lookup.reservation.time_slot_label}
                  </strong>
                </div>
                <div className={styles.ticketRow}>
                  <span>Guests</span>
                  <strong>{lookup.reservation.guest_count}</strong>
                </div>
              </div>
            </article>

            <div className={styles.actions}>
              <form action="/api/reservation-action" method="post">
                <input type="hidden" name="token" value={token} />
                <button
                  className={styles.button}
                  name="decision"
                  value="approve"
                  type="submit"
                >
                  Approve request
                </button>
              </form>
              <form action="/api/reservation-action" method="post">
                <input type="hidden" name="token" value={token} />
                <button
                  className={`${styles.button} ${styles.secondaryButton}`}
                  name="decision"
                  value="reject"
                  type="submit"
                >
                  Reject request
                </button>
              </form>
            </div>
          </>
        )}

        {lookup.state === "already_decided" && (
          <p className={styles.notice} role="status">
            A decision has already been recorded for this reservation (
            <strong>{lookup.reservation.status}</strong>). This action link can
            no longer be used.
          </p>
        )}

        {lookup.state === "expired" && (
          <p className={`${styles.notice} ${styles.error}`} role="alert">
            This reservation action link has expired.
          </p>
        )}

        {lookup.state === "invalid" && (
          <p className={`${styles.notice} ${styles.error}`} role="alert">
            This reservation action link is invalid or unavailable.
          </p>
        )}
      </main>
    </div>
  );
}