import { Activity, ArrowRight, Building2, Calculator, Eye, MapPin, Play, Scale, ShieldCheck, UserCheck } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext.js'
import { Logo } from '../components/Logo.jsx'
import { Photo } from '../components/Photo.jsx'
import {
  MockLiveProgress,
  MockNewCampaign,
  MockQuotes,
  MockReconciliation,
  MockRepair,
  MockReport,
} from '../components/public/Mockups.jsx'
import { PublicFooter } from '../components/public/PublicFooter.jsx'
import { PublicHeader } from '../components/public/PublicHeader.jsx'
import { usePageTitle } from '../lib/usePageTitle.js'
import { useScrollToHash } from '../lib/useScrollToHash.js'
import pub from '../styles/public.module.css'
import styles from './Home.module.css'

const STEPS = [
  {
    title: 'Create a campaign',
    text: 'A community lead logs the issue, sets a fair per household levy, and defines a target amount.',
    mock: MockNewCampaign,
  },
  {
    title: 'Residents contribute',
    text: 'Everyone sees the live progress bar update in real time as contributions come in.',
    mock: MockLiveProgress,
  },
  {
    title: 'Compare vendor quotes',
    text: 'Multiple repair quotes get logged side by side so the community can see exactly who was chosen and why.',
    mock: MockQuotes,
  },
  {
    title: 'Repair happens',
    text: 'The selected vendor completes the work while the campaign stays visible to everyone involved.',
    mock: MockRepair,
  },
  {
    title: 'Automatic reconciliation',
    text: 'CIRF compares what was collected with the actual cost and works out every refund or balance.',
    mock: MockReconciliation,
  },
  {
    title: 'Transparency report',
    text: 'Every contribution, quote and receipt ends up in one auditable record anyone can check.',
    mock: MockReport,
  },
]

const FEATURES = [
  {
    icon: Scale,
    title: 'Fair Levies',
    text: 'Every household contributes based on a method the community agrees on upfront, flat split or by unit count, calculated automatically.',
  },
  {
    icon: Activity,
    title: 'Real Time Tracking',
    text: 'Contributions update live. No one has to ask "how much do we have so far" in a WhatsApp group again.',
  },
  {
    icon: UserCheck,
    title: 'Vendor Verification',
    text: 'Compare multiple repair quotes with ratings and delivery timelines before a single naira leaves the fund.',
  },
  {
    icon: Calculator,
    title: 'Automatic Reconciliation',
    text: 'When actual cost differs from what was collected, CIRF works out the fair refund or balance for every contributor without anyone doing manual math.',
  },
  {
    icon: Eye,
    title: 'Full Transparency',
    text: 'A public audit trail of every transaction, from the first contribution to the final receipt.',
  },
  {
    icon: Building2,
    title: 'Built for Any Community',
    text: 'Estates, streets, and compounds can each run their own campaigns without limits.',
  },
]

// The public landing page, from HOME-PAGE-DESIGN.png.
export default function Home() {
  usePageTitle(null)
  useScrollToHash()
  const { status } = useAuth()
  const start = status === 'ready' ? '/dashboard' : '/welcome'

  return (
    <div className={pub.page}>
      <PublicHeader tone="dark" />

      <main>
        {/* Hero */}
        <section className={`${styles.hero} ${pub.onDark}`}>
          <Photo name="poles-street" priority className={styles.heroPhoto} />
          <div className={`${pub.container} ${styles.heroInner}`}>
            <div className={styles.heroText}>
              <p className={`${pub.eyebrow} ${styles.heroEyebrow}`}>Built for communities, not corporations</p>
              <h1 className={styles.heroTitle}>
                Stronger <br className={styles.wideBreak} />
                Communities <br className={styles.wideBreak} />
                Through <br className={styles.wideBreak} />
                <span className={pub.accent}>Transparency</span>
              </h1>
              <p className={styles.heroLead}>
                CIRF is a real time platform that helps Nigerian communities fairly levy, collect, track, and reconcile
                contributions toward the infrastructure repairs nobody else is paying for.
              </p>
              <div className={pub.actions}>
                <Link to={start} className={pub.primary}>
                  Get Started <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <a href="#how-it-works" className={pub.outline}>
                  <span className={styles.play} aria-hidden="true">
                    <Play size={12} fill="currentColor" />
                  </span>
                  See How It Works
                </a>
              </div>
            </div>
            <p className={styles.handwritten} aria-hidden="true">
              Real people.
              <br />
              Real communities.
              <br />
              Real impact.
            </p>
            <p className={styles.place}>
              <MapPin size={18} aria-hidden="true" />
              <span>
                Lagos, Nigeria
                <small>Community Estate</small>
              </span>
            </p>
          </div>
        </section>

        {/* The problem */}
        <section className={styles.problem} aria-labelledby="problem-title">
          <div className={styles.problemText}>
            <p className={`${pub.eyebrow} ${pub.eyebrowRule}`}>The problem</p>
            <h2 id="problem-title" className={`${pub.title} ${styles.sectionTitle}`}>
              The money always <br className={styles.wideBreak} />
              gets raised. <br className={styles.wideBreak} />
              <span className={pub.accent}>The trust never does.</span>
            </h2>
            <p className={styles.body}>
              When a transformer blows or a pole falls, most Nigerian communities cannot wait for a distribution company
              to fix it. Residents pool money themselves. But there is no standard way to calculate a fair levy, confirm
              who has paid, verify what a vendor actually charged, or account for what happens to the balance afterward.
            </p>
            <p className={styles.strong}>That gap is not hypothetical. It is happening right now.</p>
          </div>

          <div className={styles.stats}>
            <Stat value="₦20,000">
              Per household levy charged to residents of General Alagbado, Lagos, after a transformer fault left the area
              without power for over a week.
            </Stat>
            <Stat value="₦3.7 million">
              Raised by residents of Katampe 2, Abuja, to fix a faulty transformer themselves, followed by public protests
              demanding accountability for how it was spent.
            </Stat>
            <p className={styles.mission}>
              <ShieldCheck size={22} aria-hidden="true" />
              CIRF exists so the next community does not have to protest to find out where their money went.
            </p>
          </div>

          <Photo
            name="transformer"
            sizes="(min-width: 1000px) 34vw, 100vw"
            alt="A transformer mounted on wooden poles above a residential street"
            className={styles.problemPhoto}
          />
        </section>

        {/* How it works */}
        <section id="how-it-works" className={`${styles.how} ${pub.onDark}`} aria-labelledby="how-title">
          <div className={`${pub.container} ${styles.howInner}`}>
            <div className={styles.howIntro}>
              <p className={pub.eyebrow}>How it works</p>
              <h2 id="how-title" className={`${pub.title} ${styles.sectionTitle}`}>
                From fault to fully accounted for, <br className={styles.wideBreak} />
                <span className={pub.accent}>in six steps.</span>
              </h2>
            </div>
            <div className={styles.howAside}>
              <p className={styles.howLead}>A simple, transparent process that keeps your community informed at every stage.</p>
              <Link to="/about" className={`${pub.outline} ${styles.small}`}>
                See the Full Process <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <ol className={styles.steps}>
              {STEPS.map(({ title, text, mock: Mock }, index) => (
                <li key={title} className={styles.step}>
                  <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
                  <h3 className={styles.stepTitle}>{title}</h3>
                  <p className={styles.stepText}>{text}</p>
                  <div className={styles.mock}>
                    <Mock />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Why CIRF */}
        <section id="features" className={styles.why} aria-labelledby="why-title">
          <div className={`${pub.container} ${styles.whyInner}`}>
            <div className={styles.whyIntro}>
              <p className={pub.eyebrow}>Why CIRF</p>
              <h2 id="why-title" className={`${pub.title} ${styles.sectionTitle}`}>
                Built around fairness, not just fundraising.
              </h2>
              <p className={styles.body}>
                CIRF removes the guesswork, the confusion, and the mistrust. It gives every community the right tools to
                raise, manage and account for funds — fairly, transparently, and with confidence.
              </p>
              <Link to="/about" className={pub.textLink}>
                Learn More <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <ul className={styles.features}>
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className={styles.feature}>
                  <span className={styles.featureIcon} aria-hidden="true">
                    <Icon />
                  </span>
                  <div>
                    <h3 className={styles.featureTitle}>{title}</h3>
                    <p className={styles.featureText}>{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Trust */}
        <section className={`${styles.trust} ${pub.onDark}`} aria-labelledby="trust-title">
          <Photo name="community-walk" sizes="100vw" className={styles.trustPhoto} />
          <div className={`${pub.container} ${styles.trustInner}`}>
            <div className={styles.trustText}>
              <p className={pub.eyebrow}>Trust</p>
              <h2 id="trust-title" className={`${pub.title} ${styles.sectionTitle}`}>
                Open data.
                <br />
                Stronger trust.
              </h2>
              <p className={styles.trustBody}>
                CIRF was not built to replace how communities already organize. It was built to remove the one thing that
                breaks trust when money is involved: not knowing where it went. Every figure on this platform is traceable
                back to a real contribution, a real quote, or a real receipt.
              </p>
            </div>
            <figure className={styles.testimonial}>
              <span className={styles.testimonialAvatar} aria-hidden="true">
                CL
              </span>
              <div>
                <blockquote>
                  “With CIRF, we could see every contribution, every quote and the final cost. It gave our community real
                  confidence.”
                </blockquote>
                <figcaption>Community Leader, Magbe Estate</figcaption>
              </div>
            </figure>
          </div>
        </section>

        {/* Call to action */}
        <section className={`${styles.cta} ${pub.onDark}`} aria-labelledby="cta-title">
          <div className={`${pub.container} ${styles.ctaInner}`}>
            <Photo name="evening-street" sizes="240px" className={styles.ctaPhoto} />
            <div className={styles.ctaText}>
              <h2 id="cta-title" className={`${pub.title} ${styles.ctaTitle}`}>
                Your community already pools money for repairs. Now it can be accountable for it too.
              </h2>
              <Link to={start} className={pub.primary}>
                Get Started <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.ctaBrand}>
              <Logo tone="splash" />
              <p>
                Stronger Communities
                <br />
                Through Transparency
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

function Stat({ value, children }) {
  return (
    <div className={styles.stat}>
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statText}>{children}</p>
    </div>
  )
}
