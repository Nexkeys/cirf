import { v2 as cloudinary } from 'cloudinary'

// Cloudinary stores CIRF's images (campaign photos, payment proofs, receipts, quotes).
// Uploads go through the API so the API secret never reaches the browser. Cloudinary is
// used instead of Firebase Storage because Storage needs the paid Blaze plan.

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export function uploadImage(buffer, { folder }) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: 'image' }, (error, result) =>
        error ? reject(error) : resolve(result),
      )
      .end(buffer)
  })
}
