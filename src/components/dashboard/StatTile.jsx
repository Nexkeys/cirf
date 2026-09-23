import styles from './StatTile.module.css'

// A stat card with a round icon, as across the top of the Transparency Report and
// Contributions designs. `warn` turns the note amber (a shortfall, money waiting).
export function StatTile({ icon: Icon, label, value, note, warn = false }) {
  return (
    <section className={styles.stat}>
      <span className={styles.icon} aria-hidden="true">
        <Icon />
      </span>
      <div>
        <h2>{label}</h2>
        <p className={styles.value}>{value}</p>
        {note && <p className={`${styles.note} ${warn ? styles.warn : ''}`}>{note}</p>}
      </div>
    </section>
  )
}

// Four across when there's room, two in a narrower column, one on phones. Sized by the
// width of the column it sits in, not the window, so it works beside a side panel too.
export function StatRow({ children }) {
  return (
    <div className={styles.box}>
      <div className={styles.row}>{children}</div>
    </div>
  )
}
