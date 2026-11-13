import assert from "node:assert/strict";
import test from "node:test";

const message = {
  from: "visits@sagana.example",
  to: "admin@sagana.example",
  subject: "Reservation request",
  text: "A reservation was received.",
  html: "<p>A reservation was received.</p>",
};

async function loadBrevoClient() {
  let brevoModule;

  try {
    brevoModule = await import("../../src/lib/email/brevo.mjs");
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND") {
      throw error;
    }
  }

  assert.equal(
    typeof brevoModule?.createBrevoEmailClient,
    "function",
    "Brevo email client should be available",
  );
  return brevoModule.createBrevoEmailClient;
}

test("sends the existing email message through the Brevo transactional API", async () => {
  const createBrevoEmailClient = await loadBrevoClient();
  let request;
  const client = createBrevoEmailClient(
    "test-api-key",
    async (url, options) => {
      request = { url, options };
      return { ok: true, status: 201 };
    },
  );

  const result = await client.emails.send(message);

  assert.deepEqual(request, {
    url: "https://api.brevo.com/v3/smtp/email",
    options: {
      method: "POST",
      headers: {
        "api-key": "test-api-key",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: "visits@sagana.example" },
        to: [{ email: "admin@sagana.example" }],
        subject: "Reservation request",
        textContent: "A reservation was received.",
        htmlContent: "<p>A reservation was received.</p>",
      }),
    },
  });
  assert.deepEqual(result, { error: null });
});

test("returns Brevo HTTP failures as email delivery errors", async () => {
  const createBrevoEmailClient = await loadBrevoClient();
  const client = createBrevoEmailClient("test-api-key", async () => ({
    ok: false,
    status: 401,
  }));

  const result = await client.emails.send(message);

  assert.equal(result.error.code, "BREVO_401");
});
