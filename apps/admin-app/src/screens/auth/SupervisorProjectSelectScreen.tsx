import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  projectsService,
  setStoredActiveProjectId,
  setRequiresSupervisorProjectPick,
  useAuthContext,
} from '@staff4dshire/shared';
import type { Project } from '@staff4dshire/shared';

export function SupervisorProjectSelectScreen() {
  const { user } = useAuthContext();
  const [savingId, setSavingId] = useState<string | null>(null);
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getAll(),
  });

  const assignedProjects = projects.filter((p: Project) => p.supervisor_id === user?.id);

  const selectProject = async (projectId: string) => {
    try {
      setSavingId(projectId);
      await setStoredActiveProjectId(projectId);
      await setRequiresSupervisorProjectPick(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save project selection');
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4a026f" />
        <Text style={styles.loadingText}>Loading your assigned projects...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select current project</Text>
      <Text style={styles.subtitle}>
        Choose the project you are supervising in this session. Dashboard data will be scoped to this project.
      </Text>
      <FlatList
        data={assignedProjects}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No projects assigned to your supervisor account yet. Ask an admin to assign at least one project.
          </Text>
        }
        renderItem={({ item }) => {
          const saving = savingId === item.id;
          return (
            <TouchableOpacity
              style={[styles.projectBtn, saving && styles.projectBtnDisabled]}
              onPress={() => selectProject(item.id)}
              disabled={saving}
            >
              <Text style={styles.projectName}>{item.name}</Text>
              <Text style={styles.projectMeta}>{item.address || 'No address provided'}</Text>
              {saving ? <ActivityIndicator size="small" color="#4a026f" style={styles.projectSpinner} /> : null}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20, paddingTop: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 12, color: '#707173', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '800', color: '#4a026f', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#707173', marginBottom: 16, lineHeight: 20 },
  projectBtn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 14,
    marginBottom: 10,
  },
  projectBtnDisabled: { opacity: 0.6 },
  projectName: { fontSize: 15, fontWeight: '700', color: '#4a026f' },
  projectMeta: { marginTop: 4, color: '#707173', fontSize: 12 },
  projectSpinner: { marginTop: 8, alignSelf: 'flex-start' },
  emptyText: { color: '#707173', fontSize: 14, textAlign: 'center', marginTop: 24 },
});
