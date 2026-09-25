import { FileImage, ImageUp, LoaderCircle, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { uploadImage } from '../../lib/api.js'
import { readablePhoto } from '../../lib/images.js'
import styles from './ProofUpload.module.css'

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] // what POST /uploads/image takes
const MAX_BYTES = 4 * 1024 * 1024 // the API's limit
const MAX_SIDE = 2000 // plenty to read a receipt, and keeps phone photos well under the limit
const MIN_SIDE = 400 // smaller than this and the amount and reference can't be read

// Gets a photo or screenshot ready to upload. Phone photos are often 5 MB or more, so
// anything big is redrawn at up to 2000px as a JPEG, which stays sharp enough to read.
// A tiny image (a thumbnail, a cropped preview) is refused, since nobody could check it.
// HEIC photos can't be redrawn outside Safari, so those go up as they are.
async function prepare(file) {
  if (!TYPES.includes(file.type)) throw new Error('Upload a JPG, PNG, WebP or HEIC image')

  let image
  try {
    image = await createImageBitmap(file)
  } catch {
    if (file.size > MAX_BYTES) throw new Error('This photo is over 4 MB. Take a screenshot of it instead and upload that.')
    return file
  }

  if (Math.min(image.width, image.height) < MIN_SIDE) {
    throw new Error('This image is too small to read. Upload the original screenshot or photo, not a thumbnail.')
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height))
  if (scale === 1 && file.size <= MAX_BYTES / 2) return file

  const canvas = Object.assign(document.createElement('canvas'), {
    width: Math.round(image.width * scale),
    height: Math.round(image.height * scale),
  })
  const context = canvas.getContext('2d')
  context.fillStyle = '#fff' // transparent screenshots would otherwise turn black
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob || blob.size > MAX_BYTES) throw new Error('This photo is too large to upload. Take a screenshot of it instead.')
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}

// "Proof of Payment": pick or drop a photo or screenshot of the transfer receipt, bank
// alert or POS slip. It uploads straight away and reports the Cloudinary URL through
// onChange (null when removed). onBusy(true/false) lets the form wait for the upload.
export function ProofUpload({ value, onChange, onBusy, error, required = false, disabled = false, hint }) {
  const id = useId()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [dragging, setDragging] = useState(false)
  const shownError = problem || error

  async function take(file) {
    if (!file || busy) return
    setProblem('')
    setBusy(true)
    onBusy?.(true)
    try {
      onChange(await uploadImage(await prepare(file), 'contribution-proof'))
    } catch (err) {
      setProblem(err.message)
    } finally {
      setBusy(false)
      onBusy?.(false)
      if (input.current) input.current.value = ''
    }
  }

  const pick = () => input.current?.click()

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        Proof of Payment
        {required ? (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        ) : (
          <span className={styles.optional}> (optional)</span>
        )}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept={TYPES.join(',')}
        hidden
        disabled={disabled || busy}
        onChange={(event) => take(event.target.files?.[0])}
      />

      {value ? (
        <div className={styles.preview}>
          <a href={value} target="_blank" rel="noreferrer" className={styles.thumb} title="Open full size">
            <img src={readablePhoto(value, 400)} alt="Your proof of payment" />
          </a>
          <div className={styles.previewText}>
            <strong>
              <FileImage size={16} aria-hidden="true" /> Proof attached
            </strong>
            <span>Check that the amount, date and reference are easy to read.</span>
            <span className={styles.previewActions}>
              <button type="button" onClick={pick} disabled={disabled || busy}>
                {busy ? 'Uploading…' : 'Change'}
              </button>
              <button type="button" onClick={() => onChange(null)} disabled={disabled || busy} className={styles.remove}>
                <X size={14} aria-hidden="true" /> Remove
              </button>
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.drop} ${dragging ? styles.dragging : ''} ${shownError ? styles.invalid : ''}`}
          onClick={pick}
          disabled={disabled || busy}
          aria-describedby={`${id}-note`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            take(event.dataTransfer.files?.[0])
          }}
        >
          {busy ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <ImageUp aria-hidden="true" />}
          <strong>{busy ? 'Uploading your proof…' : 'Upload a photo or screenshot'}</strong>
          <span>{busy ? 'Please wait a moment' : 'Tap to choose, or drag it here. JPG, PNG, WebP or HEIC.'}</span>
        </button>
      )}

      <p id={`${id}-note`} className={shownError ? styles.error : styles.hint} role={shownError ? 'alert' : undefined}>
        {shownError || hint || 'A clear screenshot of the transfer receipt or bank alert, or a photo of the POS slip. The amount, date and reference must be readable.'}
      </p>
    </div>
  )
}
