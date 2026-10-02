// Bangla + English messages for RegisterParticipantError codes, shared by the
// public wizard (register_participant) and the admin manual-add form
// (admin_register_participant) — both RPCs return the same error vocabulary.
export const GENERIC_ERROR_MESSAGE = 'একটি সমস্যা হয়েছে। আবার চেষ্টা করুন। / Something went wrong. Please try again.'

export const REGISTER_ERROR_MESSAGES: Record<string, string> = {
  not_authorized: 'এই কাজের অনুমতি আপনার নেই। / You are not authorised to do this.',
  event_not_found: 'ইভেন্ট পাওয়া যায়নি। / Event not found.',
  registration_closed: 'এই ইভেন্টের জন্য রেজিস্ট্রেশন বন্ধ আছে। / Registration is closed for this event.',
  deadline_passed: 'রেজিস্ট্রেশনের সময়সীমা শেষ হয়ে গেছে। / The registration deadline has passed.',
  event_full: 'দুঃখিত, ইভেন্টের সব স্লট পূরণ হয়ে গেছে। / Sorry, all slots for this event are taken.',
  bad_phone: 'সঠিক ফোন নম্বর দিন। / Enter a valid phone number.',
  same_phone: 'Emergency নম্বর নিজের নম্বর থেকে আলাদা হতে হবে। / The emergency number must differ from your own.',
  bad_email: 'সঠিক ইমেইল ঠিকানা দিন। / Enter a valid email address.',
  bad_name: 'নামে শুধু ইংরেজি অক্ষর ব্যবহার করুন। / Use English letters only in the name.',
  bad_txid: 'সঠিক Transaction ID দিন (৮–১৫ অক্ষর)। / Enter a valid Transaction ID (8–15 characters).',
  bad_bike_type: 'সাইকেলের ধরন সঠিকভাবে নির্বাচন করুন। / Select a valid bike type.',
  bike_type_required: 'সাইকেলের ধরন নির্বাচন করুন। / Select your bike type.',
  bad_strava_link: 'Strava লিংক http:// বা https:// দিয়ে শুরু হতে হবে। / The Strava link must start with http:// or https://.',
  transport_required: 'ব্যক্তিগত গাড়ি নাকি শাটল বাস — নির্বাচন করুন। / Choose private car or shuttle bus.',
  shuttle_point_required: 'শাটল বাসে ওঠার পয়েন্ট নির্বাচন করুন। / Choose your shuttle pickup point.',
  id_document_required: '৫০+ বয়সীদের NID/পাসপোর্টের ছবি আপলোড করা বাধ্যতামূলক। / An NID/passport photo is required for this age group.',
  no_category: 'দুঃখিত, আপনার জন্য কোনো উপযুক্ত ক্যাটাগরি নেই। / Sorry, no category matches you.',
  category_full: 'দুঃখিত, এই ক্যাটাগরির স্লট শেষ হয়ে গেছে। / Sorry, this category is full.',
  dup_txid: 'এই Transaction ID দিয়ে আগে রেজিস্ট্রেশন হয়েছে। / This Transaction ID has already been used.',
  dup_phone: 'এই ফোন নম্বর দিয়ে আগে রেজিস্ট্রেশন হয়েছে। / This phone number is already registered.',
}
