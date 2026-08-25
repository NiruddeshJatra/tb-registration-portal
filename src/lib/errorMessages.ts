// Bangla messages for RegisterParticipantError codes, shared by the public wizard
// (register_participant) and the admin manual-add form (admin_register_participant) —
// both RPCs return the same error vocabulary, see supabase/schema.sql.
export const REGISTER_ERROR_MESSAGES: Record<string, string> = {
  event_not_found: 'ইভেন্ট পাওয়া যায়নি।',
  registration_closed: 'এই ইভেন্টের জন্য রেজিস্ট্রেশন বন্ধ আছে।',
  deadline_passed: 'রেজিস্ট্রেশনের সময়সীমা শেষ হয়ে গেছে।',
  event_full: 'দুঃখিত, ইভেন্টের সব স্লট পূরণ হয়ে গেছে।',
  bad_phone: 'সঠিক ফোন নম্বর দিন।',
  same_phone: 'Emergency নম্বর নিজের নম্বর থেকে আলাদা হতে হবে।',
  bad_email: 'সঠিক ইমেইল ঠিকানা দিন।',
  bad_name: 'নামে শুধু ইংরেজি অক্ষর ব্যবহার করুন।',
  bad_txid: 'সঠিক Transaction ID দিন (৮–১৫ অক্ষর)।',
  bad_bike_type: 'সাইকেলের ধরন সঠিকভাবে নির্বাচন করুন।',
  bad_strava_link: 'Strava লিংক http:// বা https:// দিয়ে শুরু হতে হবে।',
  no_category: 'দুঃখিত, আপনার জন্য কোনো উপযুক্ত ক্যাটাগরি নেই।',
  category_full: 'দুঃখিত, এই ক্যাটাগরির স্লট শেষ হয়ে গেছে।',
  dup_txid: 'এই Transaction ID দিয়ে আগে রেজিস্ট্রেশন হয়েছে।',
  dup_phone: 'এই ফোন নম্বর দিয়ে আগে রেজিস্ট্রেশন হয়েছে।',
}
