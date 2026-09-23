// Makes the web-ready images the app imports (src/assets/images) from the originals in
// public/Images. Run it again whenever an original changes:
//
//   npm run images
//
//   Photos      2 MB PNGs -> WebP at two widths, so phones download the smaller one
//   CIRF logo   split into the house mark and the "CIRF" wordmark, each trimmed to its
//               edges. The app colours them with CSS masks, so the one plain logo works
//               on light and dark screens alike.
//   Google "G"  trimmed and shrunk for the "Continue with Google" button
//   Favicon     the house mark in white on a CIRF green tile
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const ORIGINALS = 'public/Images'
const OUT = 'src/assets/images'
await mkdir(OUT, { recursive: true })

const photos = {
  'hero-skyline': 'Auth_Screen_Images/Auth-Screen-Image2.png', // Welcome screen and the desktop sign-in panel
  lineman: 'Gemini_Generated_Image_5muwbg5muwbg5muw.jpg', // About: "What CIRF is"
  'poles-street': 'Homepage_Screen_Images/Hero image.png', // Home and About heroes, dashboard sidebar card
  transformer: 'Homepage_Screen_Images/Problem-section image.png', // Home problem section, About origin, campaigns without a photo
  'community-walk': 'Homepage_Screen_Images/Trust-section image.png', // Home trust section, About "Designed around" band
  'evening-street': 'Homepage_Screen_Images/Small CTA image.png', // Home call to action, footers, About origin
}
for (const [name, file] of Object.entries(photos)) {
  for (const width of [800, 1600]) {
    await sharp(`${ORIGINALS}/${file}`)
      .resize({ width })
      .webp({ quality: 80 })
      .toFile(`${OUT}/${name}-${width}.webp`)
  }
}

// The plain logo has a transparent background. A column with any visible pixel belongs
// to the mark or the word, and the first empty gap after the mark separates the two.
const logo = `${ORIGINALS}/Logos/PLAIN-CIRF-LOGO.png`
const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const columnHasInk = (x) => {
  for (let y = 0; y < info.height; y++) if (data[(y * info.width + x) * 4 + 3] > 24) return true
  return false
}
const ink = Array.from({ length: info.width }, (_, x) => columnHasInk(x))
const markStart = ink.indexOf(true)
const markEnd = ink.indexOf(false, markStart)
const wordStart = ink.indexOf(true, markEnd)
const wordEnd = ink.lastIndexOf(true) + 1

// Cut first, then trim in a second pass: sharp trims before it extracts within one pipeline.
async function cutOut(left, right, height) {
  const slice = await sharp(logo).extract({ left, top: 0, width: right - left, height: info.height }).png().toBuffer()
  return sharp(slice).trim().resize({ height }).png().toBuffer()
}
const mark = await cutOut(markStart, markEnd, 192)
await sharp(mark).toFile(`${OUT}/cirf-mark.png`)
await sharp(await cutOut(wordStart, wordEnd, 120)).toFile(`${OUT}/cirf-wordmark.png`)

await sharp(`${ORIGINALS}/Auth_Screen_Images/Google-Signin-Logo.png`)
  .trim()
  .resize({ width: 48 })
  .png()
  .toFile(`${OUT}/google-g.png`)

// Favicon: keep the mark's shape (its alpha channel) but paint it white on a green tile.
const smallMark = await sharp(mark).resize({ height: 42 }).png().toBuffer()
const { width, height } = await sharp(smallMark).metadata()
const whiteMark = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
  .joinChannel(await sharp(smallMark).extractChannel(3).toBuffer())
  .png()
  .toBuffer()
const tile = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="#06291f"/></svg>')
await sharp(tile).composite([{ input: whiteMark, gravity: 'center' }]).png().toFile('public/favicon.png')

console.log('Images written to', OUT, 'and public/favicon.png')
