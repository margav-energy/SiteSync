import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProjectsScreen } from '../screens/projects/ProjectsScreen';
import { CreateProjectScreen } from '../screens/projects/CreateProjectScreen';

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  CreateProject: { projectId?: string } | undefined;
};

const Stack = createNativeStackNavigator<ProjectsStackParamList>();

export function ProjectsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#4a026f' },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen
        name="ProjectsList"
        component={ProjectsScreen}
        options={{ title: 'Projects' }}
      />
      <Stack.Screen
        name="CreateProject"
        component={CreateProjectScreen}
        options={({ route }) => ({
          title: route.params?.projectId ? 'Edit project' : 'New project',
          headerRight: () => null,
        })}
      />
    </Stack.Navigator>
  );
}
