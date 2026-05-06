export type AdminAuthStackParamList = {
  Login: undefined;
  InvitationRegister: { token?: string; mode?: 'request' | 'complete' } | undefined;
  AdminRegisterInfo: undefined;
};
