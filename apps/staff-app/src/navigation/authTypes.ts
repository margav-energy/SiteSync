export type StaffAuthStackParamList = {
  Login: undefined;
  StaffRegister: undefined;
  InvitationRegister: { token?: string; mode?: 'request' | 'complete' } | undefined;
};
