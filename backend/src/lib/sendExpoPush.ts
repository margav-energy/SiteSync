import Expo from 'expo-server-sdk';

const expo = new Expo();

/**
 * Send a remote notification via Expo Push Service (requires user’s `expoPushToken` on file).
 */
export async function sendExpoPushToToken(
  expoPushToken: string | null | undefined,
  params: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  if (!expoPushToken || !Expo.isExpoPushToken(expoPushToken)) {
    return;
  }
  try {
    const tickets = await expo.sendPushNotificationsAsync([
      {
        to: expoPushToken,
        sound: 'default',
        title: params.title,
        body: params.body,
        data: params.data ?? {},
      },
    ]);
    const t = tickets[0];
    if (t && 'status' in t && t.status === 'error') {
      console.warn('[expo-push] delivery error', t.message, t.details);
    }
  } catch (e) {
    console.warn('[expo-push]', (e as Error).message);
  }
}
