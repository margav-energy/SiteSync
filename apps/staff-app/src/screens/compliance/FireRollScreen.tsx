import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  useAuthContext,
  projectsService,
  usersService,
  timesheetsService,
  getStoredActiveProjectId,
} from '@staff4dshire/shared';

export function FireRollScreen() {
  const { user } = useAuthContext();
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  if (user?.role !== 'admin' && user?.role !== 'supervisor') {
    return (
      <View style={styles.blockedWrap}>
        <Text style={styles.blockedTitle}>Access restricted</Text>
        <Text style={styles.blockedText}>
          Fire roll call is only available to admins and supervisors.
        </Text>
      </View>
    );
  }

  const toggle = (name: string) => {
    setPresent((p) => ({ ...p, [name]: !p[name] }));
  };

  const isSupervisor = user?.role === 'supervisor';
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getAll(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
  });
  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets', 'fire-roll', user?.id],
    queryFn: () => timesheetsService.getAll(),
    enabled: !!user?.id,
  });

  const availableProjects = useMemo(() => {
    if (!isSupervisor || !user?.id) return projects;
    return projects.filter((p) => p.supervisor_id === user.id);
  }, [isSupervisor, user?.id, projects]);

  useEffect(() => {
    if (availableProjects.length === 0) {
      setSelectedProjectId(null);
      return;
    }
    void (async () => {
      const stored = await getStoredActiveProjectId();
      const valid = stored && availableProjects.some((p) => p.id === stored) ? stored : availableProjects[0].id;
      setSelectedProjectId(valid);
    })();
  }, [availableProjects]);

  const selectedProject = useMemo(
    () => availableProjects.find((p) => p.id === selectedProjectId) ?? null,
    [availableProjects, selectedProjectId]
  );

  const rosterUsers = useMemo(() => {
    if (!selectedProject) return [];
    const ids = new Set<string>();
    if (selectedProject.assigned_staff_id) ids.add(selectedProject.assigned_staff_id);
    if (selectedProject.supervisor_id) ids.add(selectedProject.supervisor_id);
    timesheets
      .filter((t) => t.project_id === selectedProject.id && !t.sign_out_at)
      .forEach((t) => ids.add(t.user_id));
    return users
      .filter((u) => ids.has(u.id))
      .map((u) => ({
        id: u.id,
        name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedProject, timesheets, users]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        Emergency roll call — supervisors mark who is accounted for.
      </Text>
      <Text style={styles.projectLabel}>Project</Text>
      <View style={styles.projectChips}>
        {availableProjects.map((p) => {
          const active = p.id === selectedProjectId;
          return (
            <Pressable
              key={p.id}
              style={[styles.projectChip, active && styles.projectChipOn]}
              onPress={() => setSelectedProjectId(p.id)}
            >
              <Text style={[styles.projectChipText, active && styles.projectChipTextOn]}>{p.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {selectedProject == null ? (
        <Text style={styles.empty}>No project selected for roll call.</Text>
      ) : rosterUsers.length === 0 ? (
        <Text style={styles.empty}>No staff available for this project right now.</Text>
      ) : (
        rosterUsers.map((person) => (
          <Pressable key={person.id} style={styles.row} onPress={() => toggle(person.id)}>
            <Text style={styles.name}>{person.name}</Text>
            <Text style={styles.badge}>{present[person.id] ? 'Present' : 'Tap to mark'}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  blockedWrap: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  blockedTitle: { fontSize: 18, fontWeight: '700', color: '#4a026f', marginBottom: 8 },
  blockedText: { fontSize: 14, color: '#707173', textAlign: 'center', lineHeight: 20 },
  lead: { fontSize: 14, color: '#707173', lineHeight: 20, marginBottom: 16 },
  projectLabel: { fontSize: 13, fontWeight: '700', color: '#4a026f', marginBottom: 8 },
  projectChips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  projectChip: {
    borderWidth: 1,
    borderColor: '#c6b4d3',
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  projectChipOn: { borderColor: '#4a026f', backgroundColor: '#ede7f6' },
  projectChipText: { color: '#5e4f6c', fontSize: 12, fontWeight: '600' },
  projectChipTextOn: { color: '#4a026f' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  name: { fontSize: 16, color: '#333' },
  badge: { fontSize: 14, color: '#4a026f', fontWeight: '600' },
  empty: { fontSize: 13, color: '#707173', marginTop: 8 },
});
