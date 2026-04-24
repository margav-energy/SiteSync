/**
 * Presence line for chat headers from `last_login_at` (no real-time socket presence yet).
 */
export function formatChatPresence(lastLoginAt?: string): string {
  if (!lastLoginAt) return 'Offline';
  const last = new Date(lastLoginAt).getTime();
  if (Number.isNaN(last)) return 'Offline';
  const now = Date.now();
  const diffMs = now - last;
  if (diffMs < 3 * 60 * 1000) return 'Online';
  if (diffMs < 60 * 60 * 1000) {
    const m = Math.floor(diffMs / 60000);
    return `Last seen ${m}m ago`;
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    const h = Math.floor(diffMs / (60 * 60 * 1000));
    return `Last seen ${h}h ago`;
  }
  try {
    return `Last seen ${new Date(last).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
  } catch {
    return 'Last seen recently';
  }
}
