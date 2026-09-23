import { ArrowRight, BadgeCheck, FileText, Scale } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext.js'
import { Photo } from '../components/Photo.jsx'
import { MockCollect, MockQuotes, MockReconciliation, MockReport } from '../components/public/Mockups.jsx'
import { PublicFooter } from '../components/public/PublicFooter.jsx'
import { PublicHeader } from '../components/public/PublicHeader.jsx'
import { usePageTitle } from '../lib/usePageTitle.js'
import { useScrollReveal } from '../lib/useScrollReveal.js'
import pub from '../styles/public.module.css'
import styles from './About.module.css'

const PILLARS = [
  ['Fair contributions', 'Every household contributes fairly, with a clear calculation and no guesswork.'],
  ['Visible decisions', 'Everyone can see where the money stands, in real time.'],
  ['Traceable outcomes', 'From vendor quotes to final reconciliation, every step leaves a record.'],
]

const PLATFORM = [
  { title: 'Collect', text: 'Track contributions in real time.', mock: <MockCollect /> },
  { title: 'Verify', text: 'Compare vendor quotes and select the best option.', mock: <MockQuotes icon={BadgeCheck} /> },
  { title: 'Reconcile', text: 'Compare costs and compute fair refunds or balances.', mock: <MockReconciliation icon={Scale} /> },
  { title: 'Report', text: 'Full audit trail for complete transparency.', mock: <MockReport icon={FileText} /> },
]

// About CIRF, from ABOUT-SCREEN.png.
export default function About() {
  usePageTitle('About')
  useScrollReveal()
  const { status } = useAuth()
  const start = status === 'ready' ? '/dashboard' : '/welcome'

  return (
    <div className={pub.page}>
      <PublicHeader tone="light" />

      <main>
        {/* Hero */}
        <section className={styles.hero}>
          <Photo name="poles-street" priority sizes="(min-width: 900px) 70vw, 100vw" className={styles.heroPhoto} />
          <div className={`${pub.container} ${styles.heroInner}`}>
            <p className={pub.eyebrow}>About CIRF</p>
            <h1 className={styles.heroTitle}>
              Infrastructure is <br className={styles.wideBreak} />
              everyone’s problem. <br className={styles.wideBreak} />
              <em className={styles.italic}>
                Accountability <br className={styles.wideBreak} />
                should be too.
              </em>
            </h1>
            <p className={styles.heroLead}>
              CIRF helps Nigerian communities make self-funded infrastructure repairs fair, visible and accountable.
            </p>
            <span className={pub.rule} />
          </div>
          <p className={styles.sideTag} aria-hidden="true">
            CIRF <span>/</span> About
          </p>
        </section>

        {/* The origin */}
        <section className={`${pub.container} ${styles.origin}`} aria-labelledby="origin-title">
          <div className={styles.originText} data-reveal>
            <p className={pub.eyebrow}>The origin</p>
            <h2 id="origin-title" className={`${pub.title} ${styles.sectionTitle}`}>
              Built for the part of repair nobody else owns.
            </h2>
            <p className={styles.body}>
              When a transformer blows or a pole falls, most Nigerian communities self-fund the repair. But there’s no
              standard way to calculate fair levies, track contributions, verify vendor costs, or reconcile the final
              balance.
            </p>
            <span className={pub.rule} />
          </div>
          <Photo
            name="transformer"
            sizes="(min-width: 1000px) 20vw, 50vw"
            alt="A pole-mounted transformer against the sky"
            className={styles.originTall}
            data-reveal
          />
          <Photo
            name="evening-street"
            sizes="(min-width: 1000px) 17vw, 50vw"
            alt="A quiet residential street lined with houses and palm trees"
            className={styles.originShort}
            data-reveal
          />
          <div className={styles.stats} data-reveal>
            <div>
              <p className={styles.statValue}>₦20,000</p>
              <p className={styles.statText}>
                Per household levy charged to residents of General Alagbado, Lagos, after a transformer fault left the
                area without power for over a week.
              </p>
            </div>
            <div>
              <p className={styles.statValue}>₦3.7 million</p>
              <p className={styles.statText}>
                Raised by residents of Katampe 2, Abuja, to fix a faulty transformer themselves, followed by public
                protests demanding accountability for how it was spent.
              </p>
            </div>
          </div>
        </section>

        {/* What CIRF is */}
        <section className={`${styles.what} ${pub.onDark}`} aria-labelledby="what-title">
          <div className={styles.whatInner}>
            <div className={styles.whatText} data-reveal>
              <p className={pub.eyebrow}>What CIRF is</p>
              <h2 id="what-title" className={`${pub.title} ${styles.whatTitle}`}>
                CIRF turns community-funded repairs into an accountable process.
              </h2>
            </div>
            <ul className={styles.pillars} data-reveal>
              {PILLARS.map(([title, text]) => (
                <li key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.whatPhotoBox} data-reveal>
            <Photo
              name="lineman"
              sizes="(min-width: 1000px) 27vw, 100vw"
              alt="A line worker in a hard hat repairing cables on an electricity pole"
              className={styles.whatPhoto}
            />
            <p className={styles.caption}>
              Real communities.
              <br />
              Real infrastructure.
              <br />
              Real impact.
            </p>
          </div>
        </section>

        {/* The platform */}
        <section className={`${pub.container} ${styles.platform}`} aria-labelledby="platform-title">
          <div data-reveal>
            <p className={pub.eyebrow}>The platform</p>
            <h2 id="platform-title" className={`${pub.title} ${styles.sectionTitle}`}>
              From contribution to accountability.
            </h2>
          </div>
          <ol className={styles.cards}>
            {PLATFORM.map(({ title, text, mock }) => (
              <li key={title} data-reveal>
                <div className={styles.mock}>{mock}</div>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardText}>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Designed around communities */}
        <section className={`${styles.band} ${pub.onDark}`} aria-labelledby="band-title">
          <Photo name="community-walk" sizes="100vw" className={styles.bandPhoto} />
          <div className={`${pub.container} ${styles.bandInner}`}>
            <h2 id="band-title" className={`${pub.title} ${styles.bandTitle}`} data-reveal>
              Designed around how communities already solve problems.
            </h2>
            <p className={styles.bandText} data-reveal>
              CIRF does not replace community organization; it gives it structure, visibility and accountability.
            </p>
          </div>
        </section>

        {/* Call to action */}
        <section className={styles.cta} aria-labelledby="cta-title">
          <Photo name="skyline" sizes="(min-width: 900px) 32vw, 100vw" className={styles.ctaPhoto} />
          <div className={styles.ctaText} data-reveal>
            <h2 id="cta-title" className={`${pub.title} ${styles.ctaTitle}`}>
              Every naira should have a traceable destination.
            </h2>
            <p>That is what CIRF is here to make possible.</p>
            <Link to={start} className={`${pub.primary} ${styles.ctaButton}`}>
              Get Started <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.ctaArt} aria-hidden="true">
            <PylonSketch />
            <p>
              Stronger Communities
              <br />
              Through Transparency
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

// The faint line drawing of a pylon beside the call to action.
function PylonSketch() {
  return (
    <svg viewBox="0 0 160 150" className={styles.sketch}>
      <path d="M2 2v146h156" />
      <path d="M60 148 80 20l20 128M66 108h28M70 80h20M74 52h12M80 20v-12M58 36h44M64 64h32" />
      <path d="M66 108 90 80M94 108 70 80M70 80l16-28M90 80 74 52" />
      <path d="M100 148c10-30 30-44 56-50" />
    </svg>
  )
}
