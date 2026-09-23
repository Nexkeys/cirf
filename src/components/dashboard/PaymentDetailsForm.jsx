import { Hash, Landmark, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../Button.jsx'
import { FormAlert } from '../FormAlert.jsx'
import { FormField } from './FormField.jsx'
import styles from './PaymentDetailsForm.module.css'

const EMPTY = { bankName: '', accountName: '', accountNumber: '' }

// Bank, account name and 10-digit account number: where residents send their money.
// Controlled by the parent through `value`/`onChange` (the Create Campaign wizard), or,
// given `onSave`, a small form of its own with a Save button (Make a Contribution).
export function PaymentDetailsForm({ value, onChange, onSave, errors = {} }) {
  const [draft, setDraft] = useState(value ?? EMPTY)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const details = onSave ? draft : (value ?? EMPTY)
  const shownErrors = onSave ? fieldErrors : errors

  const set = (field) => (event) => {
    const next = { ...details, [field]: field === 'accountNumber' ? event.target.value.replace(/\D/g, '').slice(0, 10) : event.target.value }
    if (onSave) setDraft(next)
    else onChange(next)
  }

  async function save() {
    setBusy(true)
    setProblem('')
    setFieldErrors({})
    try {
      await onSave(details)
    } catch (error) {
      const found = {}
      for (const field of Object.keys(EMPTY)) {
        const message = error.fieldMessage?.(field)
        if (message) found[field] = message
      }
      setFieldErrors(found)
      if (!Object.keys(found).length) setProblem(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.form}>
      <FormField label="Bank Name" icon={Landmark} placeholder="e.g. Moniepoint MFB" value={details.bankName} onChange={set('bankName')} error={shownErrors.bankName} />
      <FormField
        label="Account Name"
        icon={UserRound}
        placeholder="e.g. Maple Estate Repair Fund"
        value={details.accountName}
        onChange={set('accountName')}
        error={shownErrors.accountName}
      />
      <FormField
        label="Account Number"
        icon={Hash}
        inputMode="numeric"
        placeholder="10 digits"
        value={details.accountNumber}
        onChange={set('accountNumber')}
        error={shownErrors.accountNumber}
      />
      {onSave && (
        <div className={styles.save}>
          {problem && <FormAlert>{problem}</FormAlert>}
          <Button busy={busy} onClick={save}>
            Save Payment Details
          </Button>
        </div>
      )}
    </div>
  )
}
