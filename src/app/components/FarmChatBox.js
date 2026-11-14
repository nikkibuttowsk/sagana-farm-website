"use client";

import { useState } from "react";
import { appendFarmChatMessage } from "@/lib/homepage.mjs";
import styles from "../farm/farm-listing.module.css";

export default function FarmChatBox({ farm }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    setMessages((currentMessages) =>
      appendFarmChatMessage(currentMessages, draft, globalThis.crypto.randomUUID()),
    );
    setDraft("");
  }

  return (
    <section className={styles.chatBox} aria-labelledby="farm-chat-heading">
      <h2 className={styles.panelTitle} id="farm-chat-heading">
        Chat about {farm.name}
      </h2>
      <p className={styles.chatNotice}>Messages stay on this page and are not sent.</p>
      {messages.length > 0 ? (
        <ol className={styles.chatMessages} aria-live="polite">
          {messages.map((message) => (
            <li className={styles.chatMessage} key={message.id}>
              {message.text}
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.chatEmpty}>No messages yet.</p>
      )}
      <form className={styles.chatForm} onSubmit={handleSubmit}>
        <label className={styles.chatLabel} htmlFor="farm-chat-input">
          Your message
        </label>
        <input
          autoComplete="off"
          className={styles.chatInput}
          id="farm-chat-input"
          onChange={(event) => setDraft(event.target.value)}
          value={draft}
        />
        <button className={styles.reservationButton} type="submit">
          Add message
        </button>
      </form>
    </section>
  );
}
