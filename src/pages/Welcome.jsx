import { ArrowLeft, ArrowRight, Building2, UsersRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { HeroBackground } from '../components/HeroBackground.jsx'
import { Logo } from '../components/Logo.jsx'
import { WelcomeStory } from '../components/WelcomeStory.jsx'
import { usePageTitle } from '../lib/usePageTitle.js'
import styles from './Welcome.module.css'

const CHOICES = [
  {
    to: '/signup',
    icon: UsersRound,
    title: "I'm a Resident",
    text: 'Join your estate, pay your levy and follow every repair.',
  },
  {
    to: '/signup?role=admin',
    icon: Building2,
    title: "I'm a Community Lead",
    text: 'Set up your estate and run repair campaigns.',
  },
]

// Welcome: where Get Started leads. It tells the CIRF story, then asks which kind of
// account someone needs, so Create Account opens on the right tab.
export default function Welcome() {
  usePageTitle('Welcome')
  const navigate = useNavigate()
  const location = useLocation()

  // Back to wherever they came from on CIRF, or Home if they landed here directly.
  const goBack = () => (location.key === 'default' ? navigate('/') : navigate(-1))

  return (
    <div className={styles.page}>
      <HeroBackground photo="skyline" />

      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={goBack}>
          <ArrowLeft size={20} aria-hidden="true" />
          <span>Back</span>
        </button>
        <Link to="/" className={styles.logoLink} aria-label="CIRF home">
          <Logo tone="splash" />
        </Link>
        <Link to="/signin" className={styles.signIn}>
          Sign In
        </Link>
      </header>

      <main className={styles.content}>
        <WelcomeStory isPageHeading />

        <section className={styles.choose} aria-labelledby="choose-title">
          <h2 id="choose-title" className={styles.chooseTitle}>
            How will you use CIRF?
          </h2>
          <ul className={styles.choices}>
            {CHOICES.map(({ to, icon: Icon, title, text }) => (
              <li key={to}>
                <Link to={to} className={styles.choice}>
                  <span className={styles.choiceIcon} aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className={styles.choiceText}>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </span>
                  <ArrowRight size={20} className={styles.choiceArrow} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.already}>
            Already have an account? <Link to="/signin">Sign in</Link>
          </p>
        </section>
      </main>
    </div>
  )
}
