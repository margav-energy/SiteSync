import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Platform, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsService } from '@staff4dshire/shared';
import type { Project } from '@staff4dshire/shared';
import { Ionicons } from '@expo/vector-icons';
import type { ProjectsStackParamList } from '../../navigation/ProjectsStack';

type Nav = NativeStackNavigationProp<ProjectsStackParamList, 'ProjectsList'>;

function ProjectItem({
  item,
  onEdit,
  onDelete,
  onArchive,
}: {
  item: Project;
  onEdit: (item: Project) => void;
  onDelete: (item: Project) => void;
  onArchive: (item: Project) => void;
}) {
  return (
    <View style={styles.item}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.iconRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => onEdit(item)} accessibilityLabel="Edit project">
            <Ionicons name="pencil-outline" size={18} color="#4a026f" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, styles.deleteBtn]}
            onPress={() => onDelete(item)}
            accessibilityLabel="Delete project"
          >
            <Ionicons name="trash-outline" size={18} color="#b71c1c" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.meta}>
        {item.completed ? 'Completed' : 'In progress'} · {item.archived ? 'Archived' : 'Active'}
      </Text>
      <View style={styles.row}>
        {item.completed ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => onArchive(item)}>
            <Text style={styles.actionText}>{item.archived ? 'Unarchive' : 'Archive'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function ProjectsScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getAll(),
  });
  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => projectsService.archive(id, archived),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onError: (error: unknown) => {
      Alert.alert('Action failed', error instanceof Error ? error.message : 'Could not update project archive state');
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onError: (error: unknown) => {
      Alert.alert('Delete failed', error instanceof Error ? error.message : 'Could not delete project');
    },
  });

  const onEdit = (item: Project) => {
    navigation.navigate('CreateProject', { projectId: item.id });
  };

  const onArchive = (item: Project) => {
    archiveMutation.mutate({ id: item.id, archived: !item.archived });
  };

  const onDelete = (item: Project) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`Delete "${item.name}"? This cannot be undone.`);
      if (confirmed) {
        deleteMutation.mutate(item.id);
      }
      return;
    }
    Alert.alert(
      'Delete project',
      `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
      ]
    );
  };
  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      `${p.name} ${p.address ?? ''} ${p.project_type ?? ''} ${p.category ?? ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [projects, search]);

  if (isLoading) return <View style={styles.centered}><Text>Loading...</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Project management</Text>
      <Text style={styles.subheader}>Manage project records, status and lifecycle.</Text>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search projects"
          placeholderTextColor="#8c8c8c"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CreateProject')}>
          <Text style={styles.addBtnText}>Add project</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredProjects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProjectItem item={item} onEdit={onEdit} onDelete={onDelete} onArchive={onArchive} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#d8cfe5', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 28, fontWeight: '700', color: '#161616' },
  subheader: { fontSize: 14, color: '#6f6f78', marginTop: 4, marginBottom: 14 },
  toolbar: { flexDirection: 'row', marginBottom: 14, alignItems: 'center', gap: 10 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.42)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#2b1f39',
  },
  addBtn: {
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#2d1b3d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  addBtnText: { color: '#301f41', fontWeight: '700' },
  item: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: '#2b1f39' },
  meta: { marginTop: 6, fontSize: 12, color: '#5d5568' },
  row: { flexDirection: 'row', marginTop: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  deleteBtn: { backgroundColor: 'rgba(253,236,234,0.7)', borderColor: 'rgba(245,186,180,0.8)' },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  actionText: { color: '#2b1f39', fontSize: 12, fontWeight: '700' },
});
