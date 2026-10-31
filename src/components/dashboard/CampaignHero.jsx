import { ArrowRight, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import { timeLeft } from '../../lib/campaigns.js'
import { formatNaira } from '../../lib/format.js'
import { sizedPhoto } from '../../lib/images.js'
import { StatusBadge } from './StatusBadge.jsx'
import styles from './CampaignHero.module.css'

// The featured campaign at the top of Home: the photo, what it's for, and one big line
// of how much has been raised, with how long is left.
export function CampaignHero({ campaign, estate }) {
  const percent = Math.round(campaign.percentFunded)
  const place = [estate?.name, estate?.address].filter(Boolean).join(', ')

  return (
    <section className={styles.hero} aria-labelledby="featured-campaign">
      <img className={styles.photo} src={sizedPhoto(campaign.imageUrl, 600)} alt="" />

      <div className={styles.body}>
        <StatusBadge status={campaign.status} />
        <h2 id="featured-campaign" className={styles.title}>
          {campaign.title}
        </h2>
        {place && (
          <p className={styles.place}>
            <MapPin size={18} aria-hidden="true" />
            {place}
          </p>
        )}

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

        <Link to={`/campaigns/${campaign.id}`} className={styles.open}>
          Open this campaign <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
