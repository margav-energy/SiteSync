import AsyncStorage from '@react-native-async-storage/async-storage';

export type FitDeclarationState = {
  fit: boolean;
  noInjury: boolean;
  notFatigued: boolean;
  savedAt: string;
};

export type RamsDeclarationState = {
  read: boolean;
  understood: boolean;
  savedAt: string;
};

const fitKey = (userId: string) => `@staff4dshire/fit_declaration/${userId}`;
const ramsKey = (userId: string) => `@staff4dshire/rams_declaration/${userId}`;

export async function getFitDeclaration(userId: string): Promise<FitDeclarationState | null> {
  const raw = await AsyncStorage.getItem(fitKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FitDeclarationState;
  } catch {
    return null;
  }
}

export async function setFitDeclaration(userId: string, value: FitDeclarationState): Promise<void> {
  await AsyncStorage.setItem(fitKey(userId), JSON.stringify(value));
}

export async function getRamsDeclaration(userId: string): Promise<RamsDeclarationState | null> {
  const raw = await AsyncStorage.getItem(ramsKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RamsDeclarationState;
  } catch {
    return null;
  }
}

export async function setRamsDeclaration(userId: string, value: RamsDeclarationState): Promise<void> {
  await AsyncStorage.setItem(ramsKey(userId), JSON.stringify(value));
}
