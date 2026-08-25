export const LOCAL_ACCOUNTS_CHANGED_EVENT = "no-more-copium:local-accounts-changed";
export const LOCAL_CHAT_CHANGED_EVENT = "no-more-copium:local-chat-changed";
export const LOCAL_WORKOUT_HISTORY_CHANGED_EVENT = "no-more-copium:local-workout-history-changed";
export const LOCAL_PROGRESS_PICTURES_CHANGED_EVENT =
  "no-more-copium:local-progress-pictures-changed";
export const LOCAL_MEDIA_CHANGED_EVENT = "no-more-copium:local-media-changed";

export function emitLocalEvent<T>(name: string, detail?: T): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<T>(name, { detail }));
}
