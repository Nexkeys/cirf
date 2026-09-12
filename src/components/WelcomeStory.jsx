import { FeatureList } from './FeatureList.jsx'
import styles from './WelcomeStory.module.css'

// The headline, introduction and features from the Welcome screen. The same story sits
// in the photo panel beside the forms on wide screens, where it isn't the page heading.
export function WelcomeStory({ isPageHeading = false }) {
  const Heading = isPageHeading ? 'h1' : 'p'
  return (
    <div className={styles.story}>
      <Heading className={styles.heading}>
        Community
        <br />
        Infrastructure
        <br />
        <span className={styles.accent}>Repair Fund Tracker</span>
      </Heading>
      <p className={styles.intro}>
        A transparent, real-time platform that helps communities and estates fairly levy, collect, track and
        reconcile contributions toward infrastructure repairs.
      </p>
      <div className={styles.features}>
        <FeatureList withDetail />
      </div>
    </div>
  )
}
