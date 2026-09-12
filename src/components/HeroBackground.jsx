import skylineLarge from '../assets/images/hero-skyline-1600.webp'
import skylineSmall from '../assets/images/hero-skyline-800.webp'
import streetLarge from '../assets/images/hero-street-1600.webp'
import streetSmall from '../assets/images/hero-street-800.webp'
import styles from './HeroBackground.module.css'

const PHOTOS = {
  skyline: [skylineSmall, skylineLarge], // Welcome screen, and the photo panel beside the forms on desktop
  street: [streetSmall, streetLarge], // Home screen
}

// The photo behind a dark screen, framed the way the design frames it, under the dark
// gradient that keeps white text readable. It fills its nearest positioned parent.
export function HeroBackground({ photo }) {
  const [small, large] = PHOTOS[photo]
  return (
    <div className={`${styles.hero} ${styles[photo]}`} aria-hidden="true">
      <img
        className={styles.photo}
        src={large}
        srcSet={`${small} 800w, ${large} 1600w`}
        sizes="(min-width: 960px) 60vw, 200vw"
        alt=""
        fetchPriority="high"
      />
      <div className={styles.shade} />
    </div>
  )
}
