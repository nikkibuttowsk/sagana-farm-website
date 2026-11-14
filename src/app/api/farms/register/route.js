import { createAdminSupabaseClient } from "@/lib/supabase/clients.mjs";
import { createEmailClient } from "@/lib/email/client.mjs";
import { requireServerEnv } from "@/lib/config/env.mjs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid request payload." }, { status: 400 });
    }

  // Honeypot check
    if (typeof body.website === "string" && body.website.trim() !== "") {
        return Response.json({ saved: true });
    }

    const name = String(body.farm_name ?? "").trim();
    const province = String(body.province ?? "").trim();
    const location = String(body.location ?? "").trim();
    const adminEmail = String(body.admin_email ?? "").trim();
    const crops = String(body.crops ?? "").trim();
    const season = String(body.season ?? "all").trim();
    const bearingSeason = String(body.bearing_season ?? "").trim();
    const hours = String(body.hours ?? "").trim();
    const description = String(body.description ?? "").trim();
    const entranceFee = String(body.entrance_fee ?? "").trim();
    const imageUrl = String(body.image_url ?? "").trim();
    const latRaw = String(body.latitude ?? "").trim();
    const lngRaw = String(body.longitude ?? "").trim();

    const errors = {};
    if (!name) errors.farm_name = "Farm name is required.";
    if (!province) errors.province = "Province or region is required.";
    if (!location) errors.location = "Complete address is required.";
    if (!adminEmail || !EMAIL_PATTERN.test(adminEmail)) {
        errors.admin_email = "Please enter a valid administrator email.";
    }
    if (!crops) errors.crops = "Please enter at least one crop.";

    const latitude = latRaw ? Number(latRaw) : null;
    const longitude = lngRaw ? Number(lngRaw) : null;
    if (latRaw && (Number.isNaN(latitude) || latitude < -90 || latitude > 90)) {
        errors.latitude = "Latitude must be between -90 and 90.";
    }
    if (lngRaw && (Number.isNaN(longitude) || longitude < -180 || longitude > 180)) {
        errors.longitude = "Longitude must be between -180 and 180.";
    }

    if (Object.keys(errors).length > 0) {
        return Response.json({ saved: false, errors }, { status: 400 });
    }

    try {
        const supabase = createAdminSupabaseClient();

        const cropsArray = crops
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        const imagesArray = imageUrl ? [imageUrl] : [];

        const { data, error } = await supabase
        .from("farms")
        .insert({
            name,
            province,
            location,
            admin_email: adminEmail,
            entrance_fee: entranceFee || null,
            crops: cropsArray,
            season,
            bearing_season: bearingSeason || null,
            hours: hours || null,
            description: description || null,
            latitude,
            longitude,
            images: imagesArray,
            status: "pending",
            is_active: false,
            is_trending: false,
        })
        .select("id, name")
        .single();

        //seed default time slots so the farm is ready for bookings once approved
        const defaultSlots = [
        { farm_id: data.id, label: "08:00 - 10:00", sort_order: 1, is_active: true },
        { farm_id: data.id, label: "10:00 - 12:00", sort_order: 2, is_active: true },
        { farm_id: data.id, label: "13:00 - 15:00", sort_order: 3, is_active: true },
        { farm_id: data.id, label: "15:00 - 17:00", sort_order: 4, is_active: true },
        ];

        const { error: slotsError } = await supabase
        .from("farm_time_slots")
        .insert(defaultSlots);

        if (slotsError) {
        console.error("Failed to seed default farm time slots:", slotsError);
        }

        if (error) {
        console.error("Failed to insert farm registration:", error);
        return Response.json(
            { saved: false, error: "Could not save your farm listing. Please try again." },
            { status: 500 },
        );
        }

        // Notify SAGANA platform admin via Brevo (best-effort)
        try {
        const { FARM_ADMIN_EMAIL, RESERVATION_FROM_EMAIL } = requireServerEnv([
            "FARM_ADMIN_EMAIL",
            "RESERVATION_FROM_EMAIL",
        ]);
        const emailClient = createEmailClient();
        await emailClient.emails.send({
            from: RESERVATION_FROM_EMAIL,
            to: FARM_ADMIN_EMAIL,
            subject: `New farm registration: ${name} (${province})`,
            text: `A new farm registered on SAGANA:\n\nFarm: ${name}\nProvince: ${province}\nAddress: ${location}\nOwner Email: ${adminEmail}\nCrops: ${crops}\nSeason: ${season}\n\nReview in Supabase (farms table, ID: ${data.id}) and set is_active = true to publish.`,
            html: `<h2>New Farm Registration</h2>
            <p><strong>Farm:</strong> ${name}</p>
            <p><strong>Province:</strong> ${province}</p>
            <p><strong>Address:</strong> ${location}</p>
            <p><strong>Owner Email:</strong> ${adminEmail}</p>
            <p><strong>Crops:</strong> ${crops}</p>
            <p><strong>Season:</strong> ${season}</p>
            <p>Open your Supabase <code>farms</code> table (ID: <code>${data.id}</code>) and set <code>is_active = true</code> and <code>status = 'approved'</code> to publish this farm.</p>`,
        });
        } catch (emailErr) {
        console.error("Farm registration admin alert failed:", emailErr);
        }

        return Response.json({ saved: true, farmId: data.id });
    } catch (err) {
        console.error("Unexpected farm registration error:", err);
        return Response.json(
        { saved: false, error: "Server configuration error. Please try again later." },
        { status: 500 },
        );
    }
}