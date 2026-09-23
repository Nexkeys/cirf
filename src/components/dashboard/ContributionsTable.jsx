import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { formatDate, formatNaira, initials } from '../../lib/format.js'
import { methodLabel } from '../../lib/campaigns.js'
import styles from './ContributionsTable.module.css'

const STATUS = {
  verified: { label: 'Paid', className: 'paid' },
  pending: { label: 'Pending', className: 'pending' },
  rejected: { label: 'Rejected', className: 'rejected' },
}

// Recent contributions, as in the campaign designs. `last` picks the final column:
// "status" (Paid / Pending) or "method" (Bank Transfer, Cash...). With `pageSize`, rows
// are paged with the numbered buttons from the design.
export function ContributionsTable({ contributions, last = 'status', pageSize, empty = 'No contributions yet.' }) {
  const [page, setPage] = useState(1)
  const pages = pageSize ? Math.max(Math.ceil(contributions.length / pageSize), 1) : 1
  const current = Math.min(page, pages)
  const rows = pageSize ? contributions.slice((current - 1) * pageSize, current * pageSize) : contributions

  if (!contributions.length) return <p className={styles.empty}>{empty}</p>

  return (
    <div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Amount</th>
              <th scope="col">Date</th>
              <th scope="col">{last === 'method' ? 'Method' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((contribution) => {
              const status = STATUS[contribution.status] ?? STATUS.pending
              return (
                <tr key={contribution.id}>
                  <td>
                    <span className={styles.person}>
                      <span className={styles.avatar} aria-hidden="true">
                        {initials(contribution.userName)}
                      </span>
                      {contribution.userName}
                    </span>
                  </td>
                  <td className={styles.amount}>{formatNaira(contribution.amount)}</td>
                  <td className={styles.date}>{formatDate(contribution.paidAt ?? contribution.verifiedAt ?? contribution.createdAt)}</td>
                  <td>
                    {last === 'method' ? (
                      <span className={`${styles.pill} ${styles.method}`}>{methodLabel(contribution.method)}</span>
                    ) : (
                      <span className={`${styles.pill} ${styles[status.className]}`}>{status.label}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className={styles.pager} aria-label="Contribution pages">
          <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          {pageNumbers(current, pages).map((number, index) =>
            number === '…' ? (
              <span key={`gap-${index}`} className={styles.gap}>
                …
              </span>
            ) : (
              <button
                key={number}
                type="button"
                onClick={() => setPage(number)}
                className={number === current ? styles.currentPage : ''}
                aria-current={number === current ? 'page' : undefined}
              >
                {number}
              </button>
            ),
          )}
          <button type="button" onClick={() => setPage(current + 1)} disabled={current === pages} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  )
}

// 1 2 3 4 5 … 12, keeping the current page in view.
function pageNumbers(current, pages) {
  if (pages <= 6) return Array.from({ length: pages }, (_, i) => i + 1)
  const start = Math.max(1, Math.min(current - 2, pages - 4))
  const shown = Array.from({ length: 5 }, (_, i) => start + i)
  return shown.at(-1) < pages ? [...shown, '…', pages] : shown
}
