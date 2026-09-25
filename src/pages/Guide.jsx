import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronDown,
  CircleCheck,
  CirclePlus,
  ClipboardCheck,
  Coins,
  FileText,
  Hammer,
  HandCoins,
  House,
  Info,
  KeyRound,
  LayoutList,
  LoaderCircle,
  LogIn,
  LogOut,
  Megaphone,
  Menu,
  Scale,
  Settings,
  ShieldCheck,
  Store,
  UserPlus,
} from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext.js'
import { PublicFooter } from '../components/public/PublicFooter.jsx'
import { PublicHeader } from '../components/public/PublicHeader.jsx'
import { usePageTitle } from '../lib/usePageTitle.js'
import { useScrollReveal } from '../lib/useScrollReveal.js'
import { useScrollToHash } from '../lib/useScrollToHash.js'
import pub from '../styles/public.module.css'
import styles from './Guide.module.css'

const SECTIONS = [
  ['what', 'What is CIRF?'],
  ['steps', 'How a repair works'],
  ['roles', 'Who can do what'],
  ['getting-in', 'Getting in'],
  ['dashboard', 'Finding your way'],
  ['residents', 'For residents'],
  ['leads', 'For community leads'],
  ['notifications', 'Notifications'],
  ['faq', 'Quick answers'],
]

const STEPS = [
  [Megaphone, 'Start a campaign', 'Community lead', 'The lead describes the repair and sets the target amount. CIRF works out each household’s share, called the levy.'],
  [HandCoins, 'Contribute', 'Residents', 'Residents pay into the estate’s bank account as usual, then record the payment in CIRF with a proof of payment (a screenshot or photo of the receipt).'],
  [BadgeCheck, 'Verify', 'Community lead', 'The lead checks each payment against the bank alert, then verifies it so it counts, or rejects it with a reason.'],
  [ClipboardCheck, 'Compare quotes', 'Community lead', 'The lead adds quotes from repair companies and picks one. If it isn’t the cheapest, they must explain why.'],
  [Hammer, 'Complete the repair', 'Community lead', 'When the work is done, the lead records what was actually paid and uploads the receipt.'],
  [Scale, 'Reconcile and report', 'CIRF', 'CIRF compares what was collected with what was spent, shows each person’s refund or balance, and creates a Transparency Report for everyone.'],
]

// [what, residents can, leads can]
const ROLES = [
  ['See campaigns, progress and charts', true, true],
  ['Make a contribution and upload proof of payment', true, true],
  ['See your own payments and whether they’re verified', true, true],
  ['See every verified contribution in the estate', true, true],
  ['Read and download the Transparency Report', true, true],
  ['Get notifications and choose which ones', true, true],
  ['Edit your name and phone number', true, true],
  ['Create and publish campaigns', false, true],
  ['Verify or reject contributions', false, true],
  ['Record cash collected for a resident', false, true],
  ['Add vendor quotes and choose a vendor', false, true],
  ['Mark a repair complete and run reconciliation', false, true],
  ['Approve, add, suspend or remove residents', false, true],
  ['Change estate details and the join code', false, true],
  ['Make someone a co-admin, or hand over the estate', false, true],
]

const LAYOUT_TIPS = [
  [Menu, 'The menu', 'On a computer it’s the green bar on the left. On a phone, tap the ☰ button at the top left.'],
  [Bell, 'The bell', 'Top right. The red number is how many unread notifications you have.'],
  [LoaderCircle, 'Loading', 'Grey shapes and “Please wait, loading…” mean the page is on its way. Give it a second.'],
  [CircleCheck, 'Confirmations', 'After you save, verify or upload, a small green message pops up to say it worked.'],
  [LayoutList, 'Pages', 'Long lists are split into pages. Use the numbered buttons at the bottom to move between them.'],
]

const MENU = [
  [House, 'Overview', 'Your home screen: the current campaign, how much has been raised, how many households have paid, and a chart of progress.'],
  [BadgeCheck, 'Campaigns', 'Every repair campaign in your estate. Tap one for its full details. Leads also see drafts that aren’t published yet.'],
  [CirclePlus, 'Create Campaign', 'Leads only. A three-step form: describe the repair, set the target and levy, then add where to pay and publish.'],
  [Coins, 'Contributions', 'Every payment: who paid, how much, when, the proof of payment, and whether it’s Paid, Pending or Rejected. Leads also get a Households tab.'],
  [Store, 'Vendors & Quotes', 'Quotes from repair companies side by side, and which one was chosen and why.'],
  [Scale, 'Reconciliation', 'After the repair: what was collected, what was spent, and each person’s refund or balance.'],
  [FileText, 'Transparency Report', 'The whole campaign in one place: charts, transactions, receipts and documents. Download it as a PDF or share the public link.'],
  [Settings, 'Settings', 'Residents: your profile. Leads: estate details, join code, residents, join requests, access settings and My Profile.'],
  [LogOut, 'Log Out', 'Signs you out.'],
]

const RESIDENT_TASKS = [
  {
    title: 'Pay your levy',
    steps: [
      <>Tap the campaign’s name on <b>Overview</b> (or find it under <b>Campaigns</b>), then tap <b>Make a Contribution</b> under Quick Actions.</>,
      <>Check the <b>Payment Details</b> box for the bank, account name and number, and copy the <b>reference</b> it gives you.</>,
      <>Pay from your banking app as usual, using that reference.</>,
      <>Back in CIRF, enter the <b>amount</b> and choose the <b>payment method</b>.</>,
      <>Under <b>Proof of Payment</b>, tap the box and choose the screenshot or photo of your receipt. The amount, date and reference must be easy to read.</>,
      <>Tap <b>Submit Contribution</b>. It shows as <b>Pending</b> until your lead checks it, and you’ll get a notification when it’s verified or rejected.</>,
    ],
    note: 'Paid cash? Choose Cash as the method. The proof is then optional.',
  },
  {
    title: 'Fix a blurry or missing proof',
    steps: [
      <>Go to <b>Contributions</b> and tap the view button on your payment.</>,
      <>Tap <b>Replace proof</b> (or <b>Add proof of payment</b>), choose the clearer image and tap <b>Save Proof</b>.</>,
    ],
    note: 'You can only do this while the payment is still Pending.',
  },
  {
    title: 'See where the money went',
    steps: [
      <><b>Contributions</b> shows every verified payment.</>,
      <><b>Vendors &amp; Quotes</b> shows which company did the repair and what they charged.</>,
      <><b>Transparency Report</b> puts it all together, receipts included. Tap <b>Download Full Report</b> for a PDF.</>,
    ],
  },
]

const LEAD_TASKS = [
  {
    title: 'Start a campaign',
    steps: [
      <>Tap <b>Create Campaign</b> in the menu.</>,
      <><b>Step 1:</b> give it a title, pick the category, describe the problem and add a photo.</>,
      <><b>Step 2:</b> enter the target and choose <b>Flat Split</b> (every household pays the same) or <b>By Unit Count</b> (4 flats pay 4 times as much).</>,
      <><b>Step 3:</b> add the bank account residents pay into, check everything and tap <b>Publish Campaign</b>. Or <b>Save as Draft</b> to finish later.</>,
    ],
  },
  {
    title: 'Verify or reject contributions',
    steps: [
      <>Open <b>Contributions</b>. A yellow banner says how many payments are waiting. Tap <b>Review now</b>.</>,
      <>Tap <b>Review</b> on a payment and compare the <b>proof of payment</b> with your bank alert.</>,
      <>Tap <b>Verify Contribution</b> if it’s right, or <b>Reject</b> and say why. The resident sees your reason.</>,
    ],
    note: 'Collected cash in person? Use Add Contribution, pick the resident and choose Cash. It counts straight away.',
  },
  {
    title: 'Add quotes and choose a vendor',
    steps: [
      <>Open <b>Vendors &amp; Quotes</b> and tap <b>Add Vendor Quote</b>. Enter the company, amount, timeline and warranty.</>,
      <>Add at least two quotes so residents can compare.</>,
      <>Tap <b>⋮</b> on the quote you want, then <b>Select this vendor</b>. If it isn’t the cheapest, give your reason.</>,
    ],
  },
  {
    title: 'Finish the repair and reconcile',
    steps: [
      <>Open <b>Reconciliation</b> and tap <b>Mark as Complete</b>.</>,
      <>Enter what was <b>actually paid</b>, break it down if you like, and upload the receipt.</>,
      <>Tap <b>Run Reconciliation</b>. CIRF works out every refund or balance, and the report is ready.</>,
      <>On <b>Transparency Report</b>, tap <b>Share Report</b> to send the public link. It hides residents’ names.</>,
    ],
  },
  {
    title: 'Manage your estate',
    steps: [
      <><b>Join Requests:</b> approve or decline people asking to join.</>,
      <><b>Residents:</b> search, add by email, edit units, suspend, make co-admin or remove.</>,
      <><b>Join Code:</b> share it so residents can join instantly. Tap ⟳ for a new one if it leaks.</>,
      <><b>Community Access:</b> choose whether new residents can find your estate and need your approval.</>,
      <><b>My Profile:</b> update your own name, phone and unit.</>,
    ],
  },
]

const FAQ = [
  ['What does “Pending” mean?', 'You’ve recorded the payment, but your community lead hasn’t checked it yet. It doesn’t count toward the target until it’s verified.'],
  ['Why was my payment rejected?', 'Open Notifications, or the payment’s details, to read the reason. Record it again with the right details or a clearer proof.'],
  ['Can CIRF take my money?', 'No. CIRF never handles money. You pay into your estate’s own bank account, and CIRF keeps the record.'],
  ['Who can see my payment?', 'Everyone in your estate can see verified payments. The public report hides names.'],
  ['I can’t see a campaign my lead mentioned.', 'It’s probably still a draft. It appears as soon as your lead publishes it.'],
  ['I’m waiting for approval. What now?', 'Your community lead has been notified. Tap Check Again later, or ask them for the join code to get in straight away.'],
]

// User Guide: CIRF explained in plain English, for residents and community leads.
export default function Guide() {
  usePageTitle('User Guide')
  useScrollReveal()
  useScrollToHash()
  const { status } = useAuth()
  const start = status === 'ready' ? '/dashboard' : '/welcome'

  return (
    <div className={pub.page}>
      <PublicHeader tone="light" />
      <main>
        <section className={styles.hero}>
          <div className={`${pub.container} ${styles.heroInner}`}>
            <p className={pub.eyebrow}>User Guide</p>
            <h1 className={styles.heroTitle}>
              Everything you need <br className={styles.wideBreak} />
              to <em className={styles.italic}>use CIRF.</em>
            </h1>
            <p className={styles.heroLead}>
              A plain-English guide for residents and community leads. No technical knowledge needed: if you can use WhatsApp and a banking
              app, you can use CIRF.
            </p>
          </div>
        </section>

        <div className={`${pub.container} ${styles.layout}`}>
          <nav className={styles.toc} aria-label="On this page">
            <p className={styles.tocTitle}>On this page</p>
            <ol>
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`}>{label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className={styles.content}>
            <Section id="what" eyebrow="The basics" title="What is CIRF?">
              <div data-reveal>
                <p className={styles.text}>
                  <b>CIRF</b> stands for <b>Community Infrastructure Repair Fund Tracker</b>. When something breaks in an estate (a
                  transformer, a pole, a cable, a borehole), residents usually raise the money to fix it themselves. Raising the money is
                  rarely the problem. <b>Trust</b> is:
                </p>
                <ul className={styles.questions}>
                  <li>Who has paid, and who hasn’t?</li>
                  <li>How much did the repair really cost?</li>
                  <li>Where did the extra money go?</li>
                </ul>
                <p className={styles.text}>
                  CIRF answers all three. It keeps one clear, shared record of every naira, from the first contribution to the final
                  receipt.
                </p>
              </div>
              <p className={styles.callout} data-reveal>
                <ShieldCheck aria-hidden="true" />
                <span>
                  <b>CIRF never moves or holds money.</b> You still pay into your estate’s bank account the way you normally would. CIRF
                  records and checks those payments so everyone can see them.
                </span>
              </p>
            </Section>

            <Section id="steps" eyebrow="The journey" title="How a repair works">
              <ol className={styles.steps}>
                {STEPS.map(([Icon, title, who, text], index) => (
                  <li key={title} className={styles.step} data-reveal>
                    <span className={styles.stepTop}>
                      <span className={styles.stepIcon} aria-hidden="true">
                        <Icon />
                      </span>
                      <span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
                    </span>
                    <h3>{title}</h3>
                    <p className={styles.who}>{who}</p>
                    <p>{text}</p>
                  </li>
                ))}
              </ol>
            </Section>

            <Section id="roles" eyebrow="Accounts" title="Who can do what">
              <p className={styles.text} data-reveal>
                There are two kinds of accounts: <b>Community Lead</b> (also called admin) and <b>Resident</b>.
              </p>
              <div className={styles.tableBox} data-reveal>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">What you can do</th>
                      <th scope="col">Resident</th>
                      <th scope="col">Lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map(([what, resident, lead]) => (
                      <tr key={what}>
                        <td>{what}</td>
                        <td>{resident ? <Yes /> : <No />}</td>
                        <td>{lead ? <Yes /> : <No />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.text} data-reveal>
                <b>Anyone with the public link</b>, even without an account, can read a campaign’s Transparency Report, with residents’
                names hidden.
              </p>
            </Section>

            <Section id="getting-in" eyebrow="Accounts" title="Getting in">
              <div className={styles.twoCards}>
                <Card icon={UserPlus} title="Creating an account">
                  <ol className={styles.list}>
                    <li>
                      Tap <b>Get Started</b> and choose <b>Resident</b> or <b>Community Lead</b>.
                    </li>
                    <li>Fill in your name, email, phone number and a password.</li>
                    <li>
                      <b>Residents:</b> type your estate’s name and pick it from the list. Your community lead will approve you.
                    </li>
                    <li>
                      <b>Community leads:</b> type your estate’s name. CIRF creates it and makes you its lead.
                    </li>
                  </ol>
                  <p className={styles.tip}>
                    <KeyRound aria-hidden="true" />
                    <span>
                      <b>Got a join code?</b> Tap “Have a join code from your community lead?” and enter the 6 characters. You’re in straight
                      away, with no waiting.
                    </span>
                  </p>
                </Card>
                <Card icon={LogIn} title="Signing in">
                  <ul className={styles.list}>
                    <li>
                      Pick the right tab first: <b>Resident</b> or <b>Community Lead</b>. Each account only works on its own tab.
                    </li>
                    <li>
                      Sign in with your <b>email or phone number</b>, or with <b>Google</b>.
                    </li>
                    <li>
                      Forgot your password? Tap <b>Forgot password?</b> and we’ll email you a reset link.
                    </li>
                    <li>
                      Every sign-in screen has a <b>Back to Home</b> button.
                    </li>
                  </ul>
                </Card>
              </div>
            </Section>

            <Section id="dashboard" eyebrow="The dashboard" title="Finding your way around">
              <ul className={styles.tips}>
                {LAYOUT_TIPS.map(([Icon, title, text]) => (
                  <li key={title} data-reveal>
                    <span className={styles.tipIcon} aria-hidden="true">
                      <Icon />
                    </span>
                    <span>
                      <b>{title}</b>
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
              <h3 className={styles.subTitle} data-reveal>
                What each menu item does
              </h3>
              <ul className={styles.menu}>
                {MENU.map(([Icon, title, text]) => (
                  <li key={title} data-reveal>
                    <span className={styles.menuIcon} aria-hidden="true">
                      <Icon />
                    </span>
                    <span>
                      <b>{title}</b>
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.callout} data-reveal>
                <Info aria-hidden="true" />
                <span>
                  Each campaign screen also has <b>tabs</b> along the top (Overview, Contributions, Vendor Quotes, Reconciliation,
                  Transparency Report), so you can jump between them without going back to the menu.
                </span>
              </p>
            </Section>

            <Section id="residents" eyebrow="Step by step" title="For residents">
              <div className={styles.tasks}>
                {RESIDENT_TASKS.map((task) => (
                  <Task key={task.title} {...task} />
                ))}
              </div>
            </Section>

            <Section id="leads" eyebrow="Step by step" title="For community leads">
              <div className={styles.tasks}>
                {LEAD_TASKS.map((task) => (
                  <Task key={task.title} {...task} />
                ))}
              </div>
            </Section>

            <Section id="notifications" eyebrow="Staying informed" title="Notifications">
              <div data-reveal>
                <p className={styles.text}>
                  Tap the <b>bell</b> at the top right to open Notifications. You’ll hear when:
                </p>
                <ul className={styles.questions}>
                  <li>a campaign is published or reaches its target</li>
                  <li>your payment is verified or rejected (leads: when a payment needs checking)</li>
                  <li>a vendor is chosen or the repair is completed</li>
                  <li>the final report is ready</li>
                </ul>
                <p className={styles.text}>
                  Filter them with <b>All, Unread, Campaigns, Contributions</b> and <b>Repairs</b>, clear them with <b>Mark all as read</b>,
                  and switch off any kind of update you don’t want in <b>Notification Preferences</b>.
                </p>
              </div>
            </Section>

            <Section id="faq" eyebrow="Help" title="Quick answers">
              <div className={styles.faq}>
                {FAQ.map(([question, answer]) => (
                  <details key={question} data-reveal>
                    <summary>
                      {question}
                      <ChevronDown aria-hidden="true" />
                    </summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </Section>

            <section className={styles.cta} data-reveal aria-labelledby="guide-cta">
              <h2 id="guide-cta" className={`${pub.title} ${styles.ctaTitle}`}>
                Ready to get started?
              </h2>
              <p>Create your account in a minute, or sign in if you already have one.</p>
              <div className={pub.actions}>
                <Link to={start} className={pub.primary}>
                  {status === 'ready' ? 'Go to Dashboard' : 'Get Started'} <ArrowRight size={18} aria-hidden="true" />
                </Link>
                {status !== 'ready' && (
                  <Link to="/signin" className={`${pub.outline} ${pub.onLight}`}>
                    Sign In
                  </Link>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}

function Section({ id, eyebrow, title, children }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <p className={`${pub.eyebrow} ${pub.eyebrowRule}`} data-reveal>
        {eyebrow}
      </p>
      <h2 id={`${id}-title`} className={`${pub.title} ${styles.sectionTitle}`} data-reveal>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Card({ icon: Icon, title, children }) {
  return (
    <div className={styles.card} data-reveal>
      <h3>
        <span className={styles.cardIcon} aria-hidden="true">
          <Icon />
        </span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Task({ title, steps, note }) {
  return (
    <div className={styles.task} data-reveal>
      <h3>{title}</h3>
      <ol className={styles.list}>
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      {note && (
        <p className={styles.tip}>
          <Info aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}
    </div>
  )
}

const Yes = () => (
  <span className={styles.yes}>
    <Check aria-hidden="true" />
    <span className="visually-hidden">Yes</span>
  </span>
)

const No = () => (
  <span className={styles.no}>
    <span aria-hidden="true">·</span>
    <span className="visually-hidden">No</span>
  </span>
)
