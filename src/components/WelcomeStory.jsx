import { FeatureList } from './FeatureList.jsx'
import styles from './WelcomeStory.module.css'

// The welcome story: CIRF's promise, the one-line summary and the three features. It is
// the Welcome screen's heading, and on wide screens it also fills the photo panel beside
// the forms, where it isn't the page heading.
export function WelcomeStory({ isPageHeading = false }) {
  const Heading = isPageHeading ? 'h1' : 'p'
  return (
    <div className={styles.story}>
      <p className={styles.eyebrow}>Community Infrastructure Repair Fund Tracker</p>
      <Heading className={styles.heading}>
        Stronger Communities Through <span className={styles.accent}>Transparency</span>
      </Heading>
      <p className={styles.intro}>
        Track contributions. Verify repair costs.
        <br />
        Reconcile funds. Build trust.
      </p>
      <div className={styles.features}>
        <FeatureList withDetail />
      </div>
    </div>
  )
}
