import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@staff4dshire/token';
const USER_KEY = '@staff4dshire/user';
const ACTIVE_COMPANY_KEY = '@staff4dshire/active_company_id';
const ACTIVE_PROJECT_KEY = '@staff4dshire/active_project_id';
const REQUIRE_SUPERVISOR_PROJECT_PICK_KEY = '@staff4dshire/require_supervisor_project_pick';

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function removeStoredToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getStoredUser(): Promise<string | null> {
  return AsyncStorage.getItem(USER_KEY);
}

export async function setStoredUser(userJson: string): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, userJson);
}

export async function removeStoredUser(): Promise<void> {
  await AsyncStorage.removeItem(USER_KEY);
}

export async function getStoredActiveCompanyId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_COMPANY_KEY);
}

export async function setStoredActiveCompanyId(id: string | null): Promise<void> {
  if (id == null) {
    await AsyncStorage.removeItem(ACTIVE_COMPANY_KEY);
  } else {
    await AsyncStorage.setItem(ACTIVE_COMPANY_KEY, id);
  }
}

export async function getStoredActiveProjectId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_PROJECT_KEY);
}

export async function setStoredActiveProjectId(id: string | null): Promise<void> {
  if (id == null) {
    await AsyncStorage.removeItem(ACTIVE_PROJECT_KEY);
  } else {
    await AsyncStorage.setItem(ACTIVE_PROJECT_KEY, id);
  }
}

export async function getRequiresSupervisorProjectPick(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(REQUIRE_SUPERVISOR_PROJECT_PICK_KEY);
  return raw === '1';
}

export async function setRequiresSupervisorProjectPick(required: boolean): Promise<void> {
  if (required) {
    await AsyncStorage.setItem(REQUIRE_SUPERVISOR_PROJECT_PICK_KEY, '1');
  } else {
    await AsyncStorage.removeItem(REQUIRE_SUPERVISOR_PROJECT_PICK_KEY);
  }
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.multiRemove([
    TOKEN_KEY,
    USER_KEY,
    ACTIVE_COMPANY_KEY,
    ACTIVE_PROJECT_KEY,
    REQUIRE_SUPERVISOR_PROJECT_PICK_KEY,
  ]);
}
