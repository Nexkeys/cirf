import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import styles from './PageHeading.module.css'

// The top-left of a dashboard screen: "← Back to …", a small label, the title and a
// line under it. Everything but the title is optional.
export function PageHeading({ back, eyebrow, title, subtitle }) {
  return (
    <div className={styles.heading}>
      {back && (
        <Link to={back.to} className={styles.back}>
          <ArrowLeft size={18} aria-hidden="true" />
          {back.label}
        </Link>
      )}
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      {title && <h1 className={styles.title}>{title}</h1>}
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  )
}
