import transformer800 from '../assets/images/transformer-800.webp'

// Campaigns without an uploaded photo show this one.
export const FALLBACK_CAMPAIGN_PHOTO = transformer800

// Campaign photos live on Cloudinary. Asking for the size the screen needs (and letting
// Cloudinary pick WebP or AVIF) keeps a 5 MB phone photo from loading on every visit.
export function sizedPhoto(url, width) {
  if (!url) return FALLBACK_CAMPAIGN_PHOTO
  return url.replace('/image/upload/', `/image/upload/c_fill,w_${width},h_${width},g_auto,q_auto,f_auto/`)
}
