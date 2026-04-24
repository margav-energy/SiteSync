import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  getRequiresSupervisorProjectPick,
  getStoredActiveProjectId,
  useAuthContext,
} from '@staff4dshire/shared';
import { MainTabs } from './MainTabs';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { StaffRegisterScreen } from '../screens/auth/StaffRegisterScreen';
import { InvitationRegisterScreen } from '../screens/auth/InvitationRegisterScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { SupervisorProjectSelectScreen } from '../screens/auth/SupervisorProjectSelectScreen';
import type { StaffAuthStackParamList } from './authTypes';

const Stack = createNativeStackNavigator();
const Auth = createNativeStackNavigator<StaffAuthStackParamList>();

function StaffAuthStack() {
  return (
    <Auth.Navigator screenOptions={{ headerShown: false }}>
      <Auth.Screen name="Login" component={LoginScreen} />
      <Auth.Screen name="StaffRegister" component={StaffRegisterScreen} />
      <Auth.Screen name="InvitationRegister" component={InvitationRegisterScreen} />
    </Auth.Navigator>
  );
}

export function RootNavigator() {
  const { loading, isAuthenticated, mustChangePassword, user } = useAuthContext();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [requiresProjectPick, setRequiresProjectPick] = useState(false);
  const [projectCheckLoading, setProjectCheckLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveProjectId(null);
      setRequiresProjectPick(false);
      setProjectCheckLoading(false);
      return;
    }
    let mounted = true;
    setProjectCheckLoading(true);
    void (async () => {
      const [id, required] = await Promise.all([
        getStoredActiveProjectId(),
        getRequiresSupervisorProjectPick(),
      ]);
      if (!mounted) return;
      setActiveProjectId(id);
      setRequiresProjectPick(required);
      setProjectCheckLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'supervisor') return;
    const timer = setInterval(async () => {
      const [id, required] = await Promise.all([
        getStoredActiveProjectId(),
        getRequiresSupervisorProjectPick(),
      ]);
      setActiveProjectId(id);
      setRequiresProjectPick(required);
    }, 1000);
    return () => clearInterval(timer);
  }, [isAuthenticated, user?.role]);

  if (loading || projectCheckLoading) {
    return null;
  }

  if (isAuthenticated && mustChangePassword) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      </Stack.Navigator>
    );
  }

  if (isAuthenticated) {
    const mustPickProject =
      user?.role === 'supervisor' && (projectCheckLoading || requiresProjectPick || !activeProjectId);
    if (mustPickProject) {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="SupervisorProjectSelect" component={SupervisorProjectSelectScreen} />
        </Stack.Navigator>
      );
    }
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Auth" component={StaffAuthStack} />
    </Stack.Navigator>
  );
}
