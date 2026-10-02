import { supabase } from '@/lib/supabase'

// Private bucket holding NID/passport photos. The public can only INSERT into
// it; reading needs an admin session (see 0012_mirsharai_marathon.sql).
export const ID_DOCUMENT_BUCKET = 'id-documents'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ID_DOCUMENT_ACCEPT = ACCEPTED_TYPES.join(',')
const MAX_EDGE = 1280
const JPEG_QUALITY = 0.7

export type IdDocumentError = 'bad_type' | 'unreadable' | 'upload_failed'

export const ID_DOCUMENT_ERROR_MESSAGES: Record<IdDocumentError, string> = {
  bad_type: 'শুধু JPG, PNG বা WebP ছবি দিন। / Only JPG, PNG or WebP photos are accepted.',
  unreadable: 'ছবিটি পড়া যায়নি — অন্য একটি ছবি দিন। / Could not read this photo — try another one.',
  upload_failed: 'আপলোড হয়নি — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন। / Upload failed — check your connection and try again.',
}

// Phone cameras produce 4–10 MB photos and the project runs on Supabase's free
// tier (1 GB storage). Every photo is scaled to a 1280px long edge and
// re-encoded as JPEG before upload — still easily legible for an ID card, and
// typically 100–250 KB. Nothing larger ever reaches the bucket.
async function shrink(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  } catch {
    return null
  }
}

// Uploads to `<event-slug>/<uuid>.jpg` and returns the object path, which is
// what the register RPCs take as p_id_document_path.
export async function uploadIdDocument(
  eventSlug: string,
  file: File,
): Promise<{ path: string } | { error: IdDocumentError }> {
  if (!ACCEPTED_TYPES.includes(file.type)) return { error: 'bad_type' }
  const blob = await shrink(file)
  if (!blob) return { error: 'unreadable' }
  const path = `${eventSlug}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(ID_DOCUMENT_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) return { error: 'upload_failed' }
  return { path }
}
