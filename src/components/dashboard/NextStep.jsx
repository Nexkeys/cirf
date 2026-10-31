import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { formatNaira } from '../../lib/format.js'
import styles from './NextStep.module.css'

// "What happens next" for one campaign: a sentence in plain words and the one or two
// buttons that matter right now, depending on who is looking and where the campaign is.
// `pending` is how many payments are waiting for a lead to check, when the screen knows.
export function NextStep({ campaign, isAdmin, pending = 0 }) {
  const step = isAdmin ? leadStep(campaign, pending) : residentStep(campaign)
  if (!step) return null

  return (
    <section className={`${styles.card} ${step.done ? styles.done : ''}`} aria-labelledby="next-title">
      <h2 id="next-title" className={styles.label}>
        What happens next
      </h2>
      <p className={styles.text}>{step.text}</p>
      <div className={styles.buttons}>
        {step.actions.map(({ to, label }, index) => (
          <Link key={to} to={to} className={index === 0 ? styles.primary : styles.secondary}>
            {label}
            {index === 0 && <ArrowRight size={20} aria-hidden="true" />}
          </Link>
        ))}
      </div>
    </section>
  )
}

function residentStep(campaign) {
  const base = `/campaigns/${campaign.id}`
  const report = { to: `${base}/report`, label: 'See where the money goes' }
  const owed = campaign.myPayment?.balance ?? 0

  switch (campaign.status) {
    case 'fundraising':
    case 'repairing':
      return owed > 0
        ? { text: `You still owe ${formatNaira(owed)} for this repair.`, actions: [{ to: `${base}/contribute`, label: 'Pay my levy' }] }
        : { text: 'You have paid your levy. Thank you!', done: true, actions: [report] }
    case 'completed':
      return { text: 'The repair is finished. Your community lead is now checking the accounts.', actions: [report] }
    case 'reconciled':
      return { text: 'The repair is finished and every naira has been accounted for.', done: true, actions: [report] }
    default:
      return null
  }
}

function leadStep(campaign, pending) {
  const base = `/campaigns/${campaign.id}`
  const record = { to: `${base}/contribute`, label: 'Record a payment' }
  const check = { to: `${base}/contributions`, label: `Check ${pending} new ${pending === 1 ? 'payment' : 'payments'}` }

  switch (campaign.status) {
    case 'draft':
      return { text: 'This campaign is a draft. Residents can’t see it until you publish it.', actions: [{ to: base, label: 'Open the campaign' }] }
    case 'fundraising':
      if (pending) return waiting(pending, [check, record])
      return {
        text: 'Collect payments from residents and add the quotes you get from vendors. Choosing a vendor starts the repair.',
        actions: [record, { to: `${base}/quotes`, label: 'Add a vendor quote' }],
      }
    case 'repairing':
      if (pending) return waiting(pending, [check, record])
      return {
        text: `${campaign.selectedVendorName ?? 'The vendor'} is doing the repair. When the work is done, mark it complete.`,
        actions: [{ to: `${base}/reconciliation`, label: 'Mark repair complete' }, record],
      }
    case 'completed':
      if (pending) return waiting(pending, [check])
      return { text: 'The repair is done. Now close the accounts so everyone can see where the money went.', actions: [{ to: `${base}/reconciliation`, label: 'Close the accounts' }] }
    case 'reconciled':
      return { text: 'All done. Every naira has been accounted for.', done: true, actions: [{ to: `${base}/report`, label: 'See the report' }] }
    default:
      return null
  }
}

const waiting = (pending, actions) => ({
  text: `${pending} ${pending === 1 ? 'payment is' : 'payments are'} waiting for you to check.`,
  actions,
})
