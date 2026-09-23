import { CalendarDays, CircleDollarSign, MapPin, Target } from 'lucide-react'
import { categoryLabel } from '../../lib/campaigns.js'
import { formatDate, formatNaira } from '../../lib/format.js'
import { sizedPhoto } from '../../lib/images.js'
import { StatusBadge } from './StatusBadge.jsx'
import styles from './CampaignHeader.module.css'

// The top of the Campaign Details and Make a Contribution screens: badge, title,
// where and what, the description, and Target / Collected / Deadline in a mint panel.
// `photo` puts the campaign photo on the left (Make a Contribution) or the right
// (Campaign Details, with a caption).
export function CampaignHeader({ campaign, estate, photo = 'left', photoCaption, headingLevel = 1 }) {
  const Heading = `h${headingLevel}`
  const place = [estate?.name, estate?.address].filter(Boolean).join(', ')
  const percent = Math.round(campaign.percentFunded ?? 0)

  return (
    <section className={`${styles.header} ${styles[photo]}`}>
      <div className={styles.photo}>
        <img src={sizedPhoto(campaign.imageUrl, 700)} alt="" />
        {photoCaption && <span className={styles.caption}>{photoCaption}</span>}
      </div>

      <div className={styles.text}>
        <StatusBadge status={campaign.status} />
        <Heading className={styles.title}>{campaign.title}</Heading>
        <p className={styles.meta}>
          {place && (
            <span>
              <MapPin size={16} aria-hidden="true" />
              {place}
            </span>
          )}
          <span>{categoryLabel(campaign.category)}</span>
          <span>Community Funded</span>
        </p>
        <p className={styles.description}>{campaign.description}</p>
      </div>

      <dl className={styles.figures}>
        <div>
          <Target aria-hidden="true" />
          <dt>Target Amount</dt>
          <dd>{formatNaira(campaign.targetAmount)}</dd>
        </div>
        <div>
          <CircleDollarSign aria-hidden="true" />
          <dt>Total Collected</dt>
          <dd>
            {formatNaira(campaign.totalCollected)}
            <small>({percent}% of target)</small>
          </dd>
        </div>
        <div>
          <CalendarDays aria-hidden="true" />
          <dt>Deadline</dt>
          <dd>{campaign.deadline ? formatDate(campaign.deadline) : 'Not set'}</dd>
        </div>
      </dl>
    </section>
  )
}
