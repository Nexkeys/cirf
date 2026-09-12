import styles from './Logo.module.css'

// The CIRF logo, made from the plain logo file. scripts/optimize-images.mjs splits it into
// the house mark and the wordmark, and both are used as CSS masks so each half can take
// the colour a screen needs:
//   light   green mark, near-black word (cream screens)
//   splash  bright green mark, white word (Welcome screen)
//   white   all white (Home screen)
// Size it with the --logo-size CSS variable (the mark's height, 32px by default).
export function Logo({ tone = 'light', className = '' }) {
  return (
    <span className={`${styles.logo} ${styles[tone]} ${className}`} role="img" aria-label="CIRF">
      <span className={styles.mark} />
      <span className={styles.word} />
    </span>
  )
}
