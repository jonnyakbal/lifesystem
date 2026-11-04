'use client';

// The flow lives in WeeklyReviewFlow so it's shared with the modal opened from INBOX.
import { WeeklyReviewFlow } from '@/components/weekly-review-flow';

export default function RevisaoPage() {
  return (
    <div className="mx-auto max-w-5xl p-4 pb-24 lg:p-8">
      <WeeklyReviewFlow />
    </div>
  );
}
