import axiosInstance from './axiosInstance';

export const pushService = {
  async registerExpoToken(expoPushToken: string): Promise<void> {
    await axiosInstance.post('/push/register', { expo_push_token: expoPushToken });
  },

  async unregister(): Promise<void> {
    try {
      await axiosInstance.post('/push/unregister');
    } catch {
      /* offline / already logged out */
    }
  },
};
