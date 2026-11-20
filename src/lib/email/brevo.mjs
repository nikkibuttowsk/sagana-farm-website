const TRANSACTIONAL_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";

export function createBrevoEmailClient(apiKey, fetchImpl = globalThis.fetch) {
  return {
    emails: {
      async send(message) {
        const response = await fetchImpl(TRANSACTIONAL_EMAIL_URL, {
          method: "POST",
          headers: {
            "api-key": apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { email: message.from },
            to: [{ email: message.to }],
            ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
            subject: message.subject,
            textContent: message.text,
            htmlContent: message.html,
          }),
        });

        if (!response.ok) {
          return {
            error: Object.assign(new Error("Brevo email delivery failed."), {
              code: `BREVO_${response.status}`,
            }),
          };
        }

        return { error: null };
      },
    },
  };
}
