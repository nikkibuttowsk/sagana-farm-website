import assert from "node:assert/strict";
import test from "node:test";
import { getFarmChatReply } from "../../src/lib/homepage.mjs";

test("answered response clears pending question and uses the AI answer", () => {
  const result = getFarmChatReply(
    { status: "answered", answer: "The farm opens at 8 AM." },
    { email: "", question: "" },
  );
  assert.deepEqual(result, {
    pendingQuestion: null,
    reply: "The farm opens at 8 AM.",
  });
});

test("needs_email response preserves the original question", () => {
  const result = getFarmChatReply(
    { status: "needs_email" },
    { email: "", question: "Do you host school field trips?" },
  );
  assert.equal(result.pendingQuestion, "Do you host school field trips?");
  assert.match(result.reply, /email/i);
});

test("escalated response clears pending state and reports no private data", () => {
  const result = getFarmChatReply(
    { status: "escalated", emailSent: false },
    { email: "visitor@example.com", question: "Do you host school field trips?" },
  );
  assert.equal(result.pendingQuestion, null);
  assert.match(result.reply, /saved your question/i);
  assert.doesNotMatch(result.reply, /visitor@example\.com/);
});

test("successful escalation never echoes the visitor email", () => {
  const result = getFarmChatReply(
    { status: "escalated", emailSent: true },
    { email: "visitor@example.com", question: "Do you host school field trips?" },
  );
  assert.equal(result.pendingQuestion, null);
  assert.doesNotMatch(result.reply, /visitor@example\.com/);
});
