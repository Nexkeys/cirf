import { MapPin } from 'lucide-react'
import { timeLeft } from '../../lib/campaigns.js'
import { formatNaira } from '../../lib/format.js'
import { sizedPhoto } from '../../lib/images.js'
import { StatusBadge } from './StatusBadge.jsx'
import styles from './CampaignHeader.module.css'

// The top of every campaign screen: a small photo, the title and status, and one line
// of money: how much is raised, out of what, and how long is left. It is the only place
// these figures appear, so the sections below don't repeat them.
export function CampaignHeader({ campaign, estate, headingLevel = 1 }) {
  const Heading = `h${headingLevel}`
  const place = [estate?.name, estate?.address].filter(Boolean).join(', ')
  const percent = Math.round(campaign.percentFunded ?? 0)

  return (
    <section className={styles.header}>
      <img className={styles.photo} src={sizedPhoto(campaign.imageUrl, 300)} alt="" />

      <div className={styles.text}>
        <StatusBadge status={campaign.status} />
        <Heading className={styles.title}>{campaign.title}</Heading>
        {place && (
          <p className={styles.place}>
            <MapPin size={17} aria-hidden="true" />
            {place}
          </p>
        )}
      </div>

      <div className={styles.money}>
        <p className={styles.raised}>
          <strong>{formatNaira(campaign.totalCollected)}</strong> raised of {formatNaira(campaign.targetAmount)}
        </p>
        <div
          className={styles.bar}
          role="progressbar"
          aria-label="Amount raised"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(percent, 100)}
        >
          <span style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
        <p className={styles.when}>
          <span>{percent}% of the target</span>
          <span>{timeLeft(campaign)}</span>
        </p>
      </div>
    </section>
  )
}
