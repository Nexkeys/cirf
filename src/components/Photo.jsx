import communityWalkLarge from '../assets/images/community-walk-1600.webp'
import communityWalkSmall from '../assets/images/community-walk-800.webp'
import eveningStreetLarge from '../assets/images/evening-street-1600.webp'
import eveningStreetSmall from '../assets/images/evening-street-800.webp'
import skylineLarge from '../assets/images/hero-skyline-1600.webp'
import skylineSmall from '../assets/images/hero-skyline-800.webp'
import linemanLarge from '../assets/images/lineman-1600.webp'
import linemanSmall from '../assets/images/lineman-800.webp'
import polesStreetLarge from '../assets/images/poles-street-1600.webp'
import polesStreetSmall from '../assets/images/poles-street-800.webp'
import transformerLarge from '../assets/images/transformer-1600.webp'
import transformerSmall from '../assets/images/transformer-800.webp'

// Every photo comes in two widths (see scripts/optimize-images.mjs), so phones download
// the 800px one and wide screens the 1600px one.
const PHOTOS = {
  'community-walk': [communityWalkSmall, communityWalkLarge],
  'evening-street': [eveningStreetSmall, eveningStreetLarge],
  lineman: [linemanSmall, linemanLarge],
  'poles-street': [polesStreetSmall, polesStreetLarge],
  skyline: [skylineSmall, skylineLarge],
  transformer: [transformerSmall, transformerLarge],
}

// `sizes` says how wide the photo shows, e.g. "(min-width: 900px) 40vw, 100vw".
// Photos below the fold load lazily unless `priority` is set. Other props (data-reveal,
// say) go on the <img>.
export function Photo({ name, sizes = '100vw', alt = '', priority = false, className = '', ...rest }) {
  const [small, large] = PHOTOS[name]
  return (
    <img
      className={className}
      src={large}
      srcSet={`${small} 800w, ${large} 1600w`}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      {...rest}
    />
  )
}
