import crypto from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/clients.mjs";
import {
  createEmailClient,
  sendFarmOwnerStatusEmail,
} from "@/lib/email/client.mjs";
import { requireServerEnv } from "@/lib/config/env.mjs";

function verifyFarmReviewToken(token, secret) {
    if (!token || !token.includes(".")) return null;
    const [payloadB64, signature] = token.split(".");

    const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(payloadB64)
        .digest("base64url");

    if (signature !== expectedSig) return null;

    try {
        const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
        if (!parsed.farmId || Date.now() > parsed.exp) return null;
        return parsed.farmId;
    } catch {
        return null;
    }
}

export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const token = searchParams.get("token");

    const { SUPABASE_SERVICE_ROLE_KEY } = requireServerEnv(["SUPABASE_SERVICE_ROLE_KEY"]);
    const farmId = verifyFarmReviewToken(token, SUPABASE_SERVICE_ROLE_KEY);

    if (!farmId) {
        return Response.json({ error: "Invalid or expired review link." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: farm, error } = await supabase
        .from("farms")
        .select("*")
        .eq("id", farmId)
        .single();

    if (error || !farm) {
        return Response.json({ error: "Farm listing not found." }, { status: 404 });
    }

    return Response.json({ farm, origin });
}

export async function POST(request) {
    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid payload." }, { status: 400 });
    }

    const { token, decision } = body;
    if (decision !== "approved" && decision !== "rejected") {
        return Response.json({ error: "Decision must be approved or rejected." }, { status: 400 });
    }

    const env = requireServerEnv([
        "SUPABASE_SERVICE_ROLE_KEY",
        "RESERVATION_FROM_EMAIL",
    ]);
    const farmId = verifyFarmReviewToken(token, env.SUPABASE_SERVICE_ROLE_KEY);

    if (!farmId) {
        return Response.json({ error: "Invalid or expired review link." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Fetch farm first to ensure single-use (only pending farms can be decided)
    const { data: existingFarm, error: fetchErr } = await supabase
        .from("farms")
        .select("*")
        .eq("id", farmId)
        .single();

    if (fetchErr || !existingFarm) {
        return Response.json({ error: "Farm not found." }, { status: 404 });
    }

    if (existingFarm.status !== "pending") {
        return Response.json(
        { error: `This farm registration has already been ${existingFarm.status}.` },
        { status: 409 },
        );
    }

    const isApproved = decision === "approved";

    const { data: updatedFarm, error: updateErr } = await supabase
        .from("farms")
        .update({
        status: decision,
        is_active: isApproved,
        })
        .eq("id", farmId)
        .select("*")
        .single();

    if (updateErr || !updatedFarm) {
        return Response.json({ error: "Failed to update farm status." }, { status: 500 });
    }

  // Email the farm owner with the outcome (POST handler)
    try {
        const origin = new URL(request.url).origin;
        const farmUrl = `${origin}/farms/${updatedFarm.id}`;

        const emailClient = createEmailClient();
        await sendFarmOwnerStatusEmail(
          updatedFarm,
          decision,
          { farmUrl },
          emailClient,
        );
    } catch (emailErr) {
        console.error("Failed to send farm status email:", emailErr);
    }

    return Response.json({ ok: true, status: decision, farm: updatedFarm });
}