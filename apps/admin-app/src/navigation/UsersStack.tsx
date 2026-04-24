import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { UsersScreen } from '../screens/users/UsersScreen';
import { CreateUserScreen } from '../screens/users/CreateUserScreen';
import { UserOnboardingViewScreen } from '../screens/users/UserOnboardingViewScreen';
import { OnboardingFormScreen } from '../screens/onboarding/OnboardingFormScreen';
import { CisOnboardingFormScreen } from '../screens/onboarding/CisOnboardingFormScreen';
import { NotificationBell } from '../components/NotificationBell';

export type UsersStackParamList = {
  UsersList: undefined;
  CreateUser: undefined;
  UserOnboarding: { userId: string };
  UserOnboardingForm: { userId: string; readOnly?: boolean };
  UserCisOnboarding: { userId: string; readOnly?: boolean };
};

const Stack = createNativeStackNavigator<UsersStackParamList>();

export function UsersStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#4a026f' },
        headerTintColor: '#fff',
        headerRight: () => <NotificationBell />,
      }}
    >
      <Stack.Screen
        name="UsersList"
        component={UsersScreen}
        options={{ title: 'Users' }}
      />
      <Stack.Screen
        name="CreateUser"
        component={CreateUserScreen}
        options={{ title: 'New user', headerRight: () => null }}
      />
      <Stack.Screen
        name="UserOnboarding"
        component={UserOnboardingViewScreen}
        options={{ title: 'User onboarding', headerRight: () => null }}
      />
      <Stack.Screen
        name="UserOnboardingForm"
        component={OnboardingFormScreen}
        options={{ title: 'Standard onboarding', headerRight: () => null }}
      />
      <Stack.Screen
        name="UserCisOnboarding"
        component={CisOnboardingFormScreen}
        options={{ title: 'CIS onboarding', headerRight: () => null }}
      />
    </Stack.Navigator>
  );
}
