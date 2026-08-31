'use client';

// This route stays working (direct URL, ⌘K search) even though it's no
// longer in the sidebar menu — the queue item that moved it out of the menu
// explicitly asked to keep it reachable by search. The actual flow lives in
// WeeklyReviewFlow so it's shared with the modal opened from INBOX.
import { WeeklyReviewFlow } from '@/components/weekly-review-flow';

export default function RevisaoPage() {
  return (
    <div className="p-8 max-w-3xl">
      <WeeklyReviewFlow />
    </div>
  );
}
