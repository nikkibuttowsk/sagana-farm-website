import styles from "./reservation.module.css";

const Icon = ({ children }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export default function TicketCard({
  farmName = "Your farm",
  location = "",
  imageUrl = "/farm-placeholder.svg",
  reference = "",
  dateLabel = "To be confirmed",
  slotLabel = "To be confirmed",
  visitors = "To be confirmed",
  bookedFor = "",
  qrDataUrl = null,
  caption = "",
}) {
  return (
    <section className={styles.tkCard}>
      <div className={styles.tkBanner}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl || "/farm-placeholder.svg"} alt="" className={styles.tkThumb} />
        <div>
          <span className={styles.tkEyebrow}>FARM VISIT · GUEST TICKET</span>
          <h2>{farmName}</h2>
          {location && <p>{location}</p>}
        </div>
      </div>

      <div className={styles.tkBody}>
        <div className={styles.tkLeft}>
          <div className={styles.tkHead}>
            <h3>Your visit</h3>
            {reference && <span className={styles.tkRef}>{reference}</span>}
          </div>

          <div className={styles.tkRow}>
            <span className={styles.tkIcon}>
              <Icon>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </Icon>
            </span>
            <div>
              <span className={styles.tkLabel}>Visit date</span>
              <strong>{dateLabel}</strong>
            </div>
          </div>

          <div className={styles.tkRow}>
            <span className={styles.tkIcon}>
              <Icon>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </Icon>
            </span>
            <div>
              <span className={styles.tkLabel}>Time slot</span>
              <strong>{slotLabel}</strong>
            </div>
          </div>

          <div className={styles.tkRow}>
            <span className={styles.tkIcon}>
              <Icon>
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
                <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.3c2 .7 3.5 2.6 3.5 5.7" />
              </Icon>
            </span>
            <div>
              <span className={styles.tkLabel}>Visitors</span>
              <strong>{visitors}</strong>
            </div>
          </div>

          {bookedFor && (
            <div className={styles.tkBooked}>
              <span>Booked for</span>
              <strong>{bookedFor}</strong>
            </div>
          )}
        </div>

        <div className={styles.tkRight}>
          <h3>Your gate check-in ticket</h3>
          <p>
            Show this ticket to the farm team on arrival.
            <br />
            They&apos;ll scan your QR code at the gate.
          </p>
          <div className={styles.tkQrFrame}>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Check-in QR code" className={styles.tkQr} />
            ) : (
              <div className={styles.tkQrEmpty} aria-hidden="true">QR</div>
            )}
          </div>
          {caption && <span className={styles.tkCaption}>{caption}</span>}
        </div>
      </div>
    </section>
  );
}