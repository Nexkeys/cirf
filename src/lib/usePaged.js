import { useState } from 'react'

// Pages through a list on the client, for the Pagination component. `resetKey` is
// anything that changes what's in the list (a search, a filter): when it changes,
// paging starts again from page 1.
export function usePaged(items, perPage, resetKey = '') {
  const [state, setState] = useState({ page: 1, key: resetKey })
  const page = state.key === resetKey ? state.page : 1
  const pages = Math.max(Math.ceil(items.length / perPage), 1)
  const current = Math.min(page, pages)
  const start = (current - 1) * perPage

  return {
    rows: items.slice(start, start + perPage),
    page: current,
    pages,
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + perPage, items.length),
    setPage: (next) => setState({ page: next, key: resetKey }),
  }
}

// 1 2 3 4 5 … 12 near the start, 1 … 7 8 9 … 12 in the middle, 1 … 8 9 10 11 12 at the end.
export function pageNumbers(current, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'gap', pages]
  if (current >= pages - 3) return [1, 'gap', ...Array.from({ length: 5 }, (_, i) => pages - 4 + i)]
  return [1, 'gap', current - 1, current, current + 1, 'gap', pages]
}
