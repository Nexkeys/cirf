import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import { daysUntil, formatDate, formatNaira } from '../../lib/format.js'
import { sizedPhoto } from '../../lib/images.js'
import { StatusBadge } from './StatusBadge.jsx'
import styles from './CampaignHero.module.css'

// The featured campaign at the top of the Overview: photo, what it's for, how far the
// fund has got, and the deadline.
export function CampaignHero({ campaign, estate }) {
  const percent = Math.round(campaign.percentFunded)
  const place = [estate?.name, estate?.address].filter(Boolean).join(', ')

  return (
    <section className={styles.hero} aria-labelledby="featured-campaign">
      <div className={styles.photo}>
        <img src={sizedPhoto(campaign.imageUrl, 600)} alt="" />
        <StatusBadge status={campaign.status} className={styles.badge} />
      </div>

      <div className={styles.body}>
        <h2 id="featured-campaign" className={styles.title}>
          <Link to={`/campaigns/${campaign.id}`}>{campaign.title}</Link>
        </h2>
        {place && (
          <p className={styles.place}>
            <MapPin size={17} aria-hidden="true" />
            {place}
          </p>
        )}
        <p className={styles.description}>{campaign.description}</p>

        <div className={styles.figures}>
          <p className={styles.figure}>
            <strong>{formatNaira(campaign.totalCollected)}</strong>
            <span>Collected</span>
          </p>
          <p className={`${styles.figure} ${styles.target}`}>
            <strong>{formatNaira(campaign.targetAmount)}</strong>
            <span>Target Amount</span>
          </p>
          <strong className={styles.percent}>{percent}%</strong>
        </div>
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
      </div>

      <dl className={styles.dates}>
        <div className={styles.date}>
          <CalendarDays aria-hidden="true" />
          <div>
            <dt>Target Date</dt>
            <dd>{campaign.deadline ? formatDate(campaign.deadline) : 'Not set'}</dd>
          </div>
        </div>
        <div className={styles.date}>
          <Clock aria-hidden="true" />
          <div>
            <TimeLeft campaign={campaign} />
          </div>
        </div>
      </dl>
    </section>
  )
}

function TimeLeft({ campaign }) {
  if (campaign.completedAt) {
    return (
      <>
        <dt>Repair Completed</dt>
        <dd>{formatDate(campaign.completedAt)}</dd>
      </>
    )
  }
  const days = daysUntil(campaign.deadline)
  if (days === null) {
    return (
      <>
        <dt>Days Remaining</dt>
        <dd>No deadline</dd>
      </>
    )
  }
  if (days < 0) {
    return (
      <>
        <dt>Deadline Passed</dt>
        <dd>{plural(-days, 'day')} ago</dd>
      </>
    )
  }
  return (
    <>
      <dt>Days Remaining</dt>
      <dd>{days === 0 ? 'Due today' : plural(days, 'day')}</dd>
    </>
  )
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
