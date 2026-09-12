import { Building2, CircleAlert, Hourglass, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.js'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { Button } from '../components/Button.jsx'
import { EstatePicker } from '../components/EstatePicker.jsx'
import { FormAlert } from '../components/FormAlert.jsx'
import { StatusIcon } from '../components/StatusIcon.jsx'
import { TextField } from '../components/TextField.jsx'
import { api } from '../lib/api.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import shared from '../styles/auth.module.css'
import s from '../styles/status.module.css'

const ROLE_NAMES = { admin: 'the Community Lead', resident: 'a resident' }

// Where people land after signing in, until the dashboards are built. It covers every
// state an account can be in: in an estate, waiting for approval, no estate yet,
// suspended, or the API unreachable.
export default function Account() {
  usePageTitle('My Account')
  const { status, user, profile, estate, joinRequest, error, refresh, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [picked, setPicked] = useState(null)
  const [estateName, setEstateName] = useState('')

  // Runs an API call, then reloads the account so the screen matches the new state.
  async function run(action) {
    setBusy(true)
    setProblem('')
    try {
      await action()
      await refresh()
    } catch (err) {
      setProblem(err.message)
    } finally {
      setBusy(false)
    }
  }

  let screen
  if (status === 'suspended') {
    screen = <Status icon={CircleAlert} title="Account Suspended" text={error} />
  } else if (status === 'error') {
    screen = (
      <Status icon={CircleAlert} title="Can't Load Your Account" text={error}>
        <Button className={s.action} busy={busy} onClick={() => run(async () => {})}>
          Try Again
        </Button>
      </Status>
    )
  } else if (estate) {
    screen = (
      <Status
        icon={Building2}
        title={`Welcome, ${profile.name.split(' ')[0]}`}
        text={
          <>
            You&apos;re signed in as {ROLE_NAMES[profile.role]} of <strong>{estate.name}</strong>. Your dashboard is
            coming next.
          </>
        }
      />
    )
  } else if (joinRequest) {
    screen = (
      <Status
        icon={Hourglass}
        title="Waiting for Approval"
        text={
          <>
            We&apos;ve asked the community lead of <strong>{joinRequest.estateName}</strong> to approve your request.
            You&apos;ll get access as soon as they do.
          </>
        }
      >
        <Button className={s.action} busy={busy} onClick={() => run(async () => {})}>
          Check Again
        </Button>
        <p className={s.footer}>
          Picked the wrong estate?
          <button
            type="button"
            className={shared.link}
            disabled={busy}
            onClick={() => run(() => api('/users/me/join-request', { method: 'DELETE' }))}
          >
            Cancel request
          </button>
        </p>
      </Status>
    )
  } else if (profile.role === 'admin') {
    screen = (
      <Status icon={Building2} title="Name Your Estate" text="Create your estate so you can start repair campaigns.">
        <form
          className={s.form}
          onSubmit={(event) => {
            event.preventDefault()
            run(() => api('/estates', { method: 'POST', body: { name: estateName.trim() } }))
          }}
        >
          <TextField
            label="Community / Estate"
            icon={MapPin}
            placeholder="e.g. Maple Estate, Alagbado"
            value={estateName}
            onChange={(event) => setEstateName(event.target.value)}
          />
          <Button type="submit" arrow busy={busy}>
            Create Estate
          </Button>
        </form>
      </Status>
    )
  } else {
    screen = (
      <Status icon={MapPin} title="Join Your Estate" text="Choose your estate. Its community lead will approve your request.">
        <form
          className={s.form}
          onSubmit={(event) => {
            event.preventDefault()
            if (!picked) return setProblem('Choose your estate from the list')
            run(() => api('/users/me/join-request', { method: 'POST', body: { estateId: picked.id } }))
          }}
        >
          <EstatePicker selected={picked} onSelect={setPicked} disabled={busy} />
          <Button type="submit" arrow busy={busy}>
            Ask to Join
          </Button>
        </form>
      </Status>
    )
  }

  return (
    <AuthLayout header="logo" className={s.page}>
      <div className={s.center}>
        {screen}
        {problem && (
          <div className={s.alert}>
            <FormAlert>{problem}</FormAlert>
          </div>
        )}
        <p className={s.footer}>
          Signed in as {user?.email}.
          <button type="button" className={shared.link} onClick={signOut}>
            Sign out
          </button>
        </p>
      </div>
    </AuthLayout>
  )
}

function Status({ icon, title, text, children }) {
  return (
    <>
      <StatusIcon icon={icon} badge={null} />
      <h1 className={s.title}>{title}</h1>
      {text && <p className={s.text}>{text}</p>}
      {children}
    </>
  )
}
