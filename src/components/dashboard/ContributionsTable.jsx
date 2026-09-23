import { formatDate, formatNaira, initials } from '../../lib/format.js'
import { methodLabel } from '../../lib/campaigns.js'
import { usePaged } from '../../lib/usePaged.js'
import { Pagination } from './Pagination.jsx'
import styles from './ContributionsTable.module.css'

const STATUS = {
  verified: { label: 'Paid', className: 'paid' },
  pending: { label: 'Pending', className: 'pending' },
  rejected: { label: 'Rejected', className: 'rejected' },
}

// Recent contributions, as in the campaign designs. `last` picks the final column:
// "status" (Paid / Pending) or "method" (Bank Transfer, Cash...). With `pageSize`, rows
// are paged with the shared Pagination.
export function ContributionsTable({ contributions, last = 'status', pageSize, empty = 'No contributions yet.' }) {
  const paged = usePaged(contributions, pageSize ?? Math.max(contributions.length, 1))
  const rows = paged.rows

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

      {pageSize && <Pagination paged={paged} noun="contributions" />}
    </div>
  )
}
