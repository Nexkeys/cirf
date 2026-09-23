import { ArrowRight, CircleCheck, Megaphone, Wrench } from 'lucide-react'
import styles from './Mockups.module.css'

// Small, static previews of CIRF screens for Home and About. They show one worked
// example with consistent figures: a ₦2,400,000 transformer repair, Sunvolt's quote of
// ₦2,320,000 selected, and ₦80,000 refunded. They're pictures, so screen readers skip
// them; the step text beside each one says the same thing in words.

const QUOTES = [
  { initials: 'SE', name: 'Sunvolt Electrical Services', amount: '₦2,320,000', meta: '3 days · 12 months', selected: true },
  { initials: 'GP', name: 'Greenline Power Solutions', amount: '₦2,450,000', meta: '5 days · 6 months' },
  { initials: 'BE', name: 'BrightFix Electricals', amount: '₦2,760,000', meta: '4 days · 12 months' },
]

function Card({ title, icon: Icon, children }) {
  return (
    <div className={styles.card} aria-hidden="true">
      <p className={styles.cardTitle}>
        {Icon && (
          <span className={styles.titleIcon}>
            <Icon />
          </span>
        )}
        {title}
      </p>
      {children}
    </div>
  )
}

const Button = ({ children }) => (
  <span className={styles.button}>
    {children} <ArrowRight />
  </span>
)

const Bar = ({ percent }) => (
  <span className={styles.bar}>
    <span style={{ width: `${percent}%` }} />
  </span>
)

export function MockNewCampaign() {
  return (
    <Card title="New Campaign">
      <span className={styles.label}>Campaign Title</span>
      <span className={styles.input}>Transformer Repair Campaign</span>
      <span className={styles.label}>Target Amount</span>
      <span className={styles.input}>₦2,400,000</span>
      <span className={styles.label}>Per-Household Levy</span>
      <span className={styles.input}>₦20,000</span>
      <Button>Next</Button>
    </Card>
  )
}

export function MockLiveProgress() {
  return (
    <Card title="Live Progress">
      <p className={styles.amount}>
        ₦1,672,000 <small>/ ₦2,400,000</small>
      </p>
      <div className={styles.barRow}>
        <Bar percent={70} />
        <small>70%</small>
      </div>
      <span className={styles.label}>Recent Contributors</span>
      <ul className={styles.people}>
        {[
          ['AY', 'Amina Yusuf'],
          ['TB', 'Tunde Bello'],
          ['CO', 'Chinedu Okafor'],
        ].map(([initials, name]) => (
          <li key={name}>
            <span className={styles.avatar}>{initials}</span>
            {name}
            <strong>₦20,000</strong>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function MockQuotes({ icon }) {
  return (
    <Card title="Vendor Quotes" icon={icon}>
      <ul className={styles.quotes}>
        {QUOTES.map((quote) => (
          <li key={quote.name}>
            <span className={styles.avatar}>{quote.initials}</span>
            <span className={styles.quote}>
              <span>{quote.name}</span>
              <strong>{quote.amount}</strong>
              <small>{quote.meta}</small>
            </span>
            {quote.selected && <span className={styles.selected}>Selected</span>}
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function MockRepair() {
  const steps = [
    ['Vendor selected', 'Sunvolt Electrical', true],
    ['Repair started', 'Aug 21, 2026', true],
    ['Transformer replaced', 'Aug 22, 2026', true],
    ['Receipt uploaded', 'Waiting', false],
  ]
  return (
    <Card title="Repair Progress" icon={Wrench}>
      <ul className={styles.checklist}>
        {steps.map(([label, detail, done]) => (
          <li key={label} className={done ? styles.done : ''}>
            <CircleCheck />
            <span>
              {label}
              <small>{detail}</small>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function MockReconciliation({ icon }) {
  return (
    <Card title="Reconciliation" icon={icon}>
      <div className={styles.split}>
        <span className={styles.box}>
          <small>Total Collected</small>₦2,400,000
        </span>
        <span className={styles.box}>
          <small>Actual Cost</small>₦2,320,000
        </span>
      </div>
      <span className={styles.refund}>
        <small>Refund / Balance</small>
        <strong>₦80,000</strong> to residents
      </span>
      <Button>View Details</Button>
    </Card>
  )
}

export function MockReport({ icon }) {
  const rows = [
    ['Contributions', '120 entries'],
    ['Quotes', '3 entries'],
    ['Receipts', '6 files'],
    ['Reconciliation', 'Completed'],
  ]
  return (
    <Card title="Transparency Report" icon={icon}>
      <ul className={styles.report}>
        {rows.map(([label, value]) => (
          <li key={label}>
            <CircleCheck />
            {label}
            <small>{value}</small>
          </li>
        ))}
      </ul>
      <Button>View Report</Button>
    </Card>
  )
}

export function MockCollect() {
  return (
    <Card title="Transformer Repair Campaign" icon={Megaphone}>
      <span className={styles.label}>Target Amount</span>
      <p className={styles.amount}>₦2,400,000</p>
      <div className={styles.barRow}>
        <Bar percent={78} />
        <small>78%</small>
      </div>
      <span className={styles.label}>Contributors</span>
      <p className={styles.small}>94 of 120 households</p>
      <Button>View Details</Button>
    </Card>
  )
}
