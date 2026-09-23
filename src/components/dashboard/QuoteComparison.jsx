import { Crown } from 'lucide-react'
import { formatNairaShort } from '../../lib/format.js'
import styles from './QuoteComparison.module.css'

// "Quote Comparison" from the Vendor Quotes design: one bar per vendor, tallest for the
// highest price, the selected vendor in green with a crown. Bars start from ₦0, so their
// heights compare honestly; the amounts sit on top.
export function QuoteComparison({ quotes, selectedId }) {
  if (!quotes.length) return <p className={styles.empty}>Quotes appear here as they're added.</p>

  const highest = Math.max(...quotes.map((quote) => quote.quotedAmount))
  const lowest = Math.min(...quotes.map((quote) => quote.quotedAmount))
  const summary = quotes.map((quote) => `${quote.vendorName} ${formatNairaShort(quote.quotedAmount)}`).join(', ')

  return (
    <div className={styles.chart} role="img" aria-label={`Quotes: ${summary}`}>
      {quotes.map((quote) => {
        const selected = quote.id === selectedId
        const status = selected ? 'Selected' : selectedId ? 'Not selected' : quote.quotedAmount === lowest ? 'Lowest' : 'Under review'
        return (
          <div key={quote.id} className={`${styles.column} ${selected ? styles.selected : selectedId ? styles.passed : ''}`}>
            <div className={styles.barArea}>
              {selected && <Crown className={styles.crown} aria-hidden="true" />}
              <span className={styles.amount}>{formatNairaShort(quote.quotedAmount)}</span>
              <span className={styles.bar} style={{ height: `${Math.max((quote.quotedAmount / highest) * 100, 4)}%` }} />
            </div>
            <span className={styles.name}>{quote.vendorName.split(' ')[0]}</span>
            <span className={styles.status}>({status})</span>
          </div>
        )
      })}
    </div>
  )
}
