import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useAuthContext } from "../hooks/AuthContext";
import { pushService } from "../api/pushService";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Keep compatibility across Expo notification behavior versions.
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * After login, requests notification permission and registers the Expo push token with the API.
 * Renders nothing. Include once inside the app tree (e.g. next to SocketProvider).
 */
export function RegisterExpoPush() {
  const { isAuthenticated } = useAuthContext();
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      lastToken.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      // Web push needs VAPID config; skip in this app to avoid startup crashes on web.
      if (Platform.OS === "web") {
        return;
      }
      if (!Device.isDevice) {
        return;
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted" || cancelled) {
        return;
      }

      const projectId =
        (
          Constants.expoConfig?.extra as
            | { eas?: { projectId?: string } }
            | undefined
        )?.eas?.projectId ??
        (Constants as { easConfig?: { projectId?: string } }).easConfig
          ?.projectId;

      try {
        const tokenRes = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        const token = tokenRes.data;
        if (cancelled || !token || token === lastToken.current) {
          return;
        }
        await pushService.registerExpoToken(token);
        lastToken.current = token;
      } catch (e) {
        console.warn("[RegisterExpoPush]", (e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return null;
}
