import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageNumbers } from '../../lib/usePaged.js'
import styles from './Pagination.module.css'

// "Showing 1 to 8 of 48 contributions" with numbered page buttons, from the
// Contributions design. Pass what usePaged (lib/usePaged.js) returned. The buttons only
// appear when there's more than one page.
export function Pagination({ paged, noun = 'items', label, className = '' }) {
  const { page, pages, total, from, to, setPage } = paged
  if (total === 0) return null

  return (
    <div className={`${styles.pager} ${className}`}>
      <span className={styles.summary}>
        {pages > 1 ? `Showing ${from} to ${to} of ${total} ${noun}` : `Showing ${total} ${total === 1 ? singular(noun) : noun}`}
      </span>
      {pages > 1 && (
        <nav className={styles.pages} aria-label={label ?? `Pages of ${noun}`}>
          <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          {pageNumbers(page, pages).map((number, index) =>
            number === 'gap' ? (
              <span key={`gap-${index}`} className={styles.gap} aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={number}
                type="button"
                onClick={() => setPage(number)}
                className={number === page ? styles.current : ''}
                aria-current={number === page ? 'page' : undefined}
                aria-label={`Page ${number}`}
              >
                {number}
              </button>
            ),
          )}
          <button type="button" onClick={() => setPage(page + 1)} disabled={page === pages} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  )
}

const singular = (noun) => noun.replace(/ies$/, 'y').replace(/s$/, '')
