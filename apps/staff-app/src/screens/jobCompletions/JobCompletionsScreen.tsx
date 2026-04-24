import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, Image } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '@staff4dshire/shared';
import { projectsService, jobCompletionsService } from '@staff4dshire/shared';
import type { JobCompletion } from '@staff4dshire/shared';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StaffDashboardStackParamList } from '../../navigation/DashboardStack';

type Nav = NativeStackNavigationProp<StaffDashboardStackParamList, 'Jobs'>;

export function JobCompletionsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthContext();
  const isSupervisor = user?.role === 'supervisor';
  const queryClient = useQueryClient();
  const [selectedCompletion, setSelectedCompletion] = React.useState<JobCompletion | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getAll(),
  });
  const { data: completions = [] } = useQuery({
    queryKey: ['job-completions'],
    queryFn: () => jobCompletionsService.getAll(),
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => jobCompletionsService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-completions'] });
      Alert.alert('Approved', 'Job completion approved and admin notified for payroll.');
    },
    onError: (err) => Alert.alert('Error', String(err)),
  });
  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => projectsService.archive(id, archived),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      Alert.alert('Updated', 'Project archive status updated.');
    },
    onError: (err) => Alert.alert('Error', String(err)),
  });

  const pendingForSupervisor = isSupervisor
    ? completions.filter((c) => c.status === 'pending' && projects.some((p) => p.id === c.project_id && p.supervisor_id === user?.id))
    : [];
  const mySubmissions = completions
    .filter((c) => c.user_id === user?.id)
    .slice(0, 10);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isSupervisor ? 'Review Job Completions' : 'Job Completions'}</Text>
      <Text style={styles.subtitle}>
        {isSupervisor
          ? 'Review and approve submissions for your projects.'
          : 'Select a project to open the submission page.'}
      </Text>

      {isSupervisor ? (
        <View style={styles.approvalCard}>
          <Text style={styles.sectionTitle}>Pending approvals</Text>
          {pendingForSupervisor.length === 0 ? (
            <Text style={styles.empty}>No pending job completions for your projects.</Text>
          ) : (
            pendingForSupervisor.map((item) => (
              <TouchableOpacity key={item.id} style={styles.pendingItem} onPress={() => setSelectedCompletion(item)}>
                <Text style={styles.pendingDesc}>{item.description}</Text>
                <Text style={styles.pendingMeta}>Photos: {item.photo_urls.length}</Text>
                <TouchableOpacity
                  style={[styles.approveBtn, approveMutation.isPending && styles.buttonDisabled]}
                  onPress={() => approveMutation.mutate(item.id)}
                  disabled={approveMutation.isPending}
                >
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.approvalCard}>
        <Text style={styles.sectionTitle}>
          {isSupervisor ? 'Submit a completion (optional)' : 'Select project'}
        </Text>
        {projects.map((p) => (
          <View key={p.id} style={styles.projectBtn}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('JobCompletionSubmit', {
                  projectId: p.id,
                  projectName: p.name,
                })
              }
            >
              <Text style={styles.projectText}>{p.name}</Text>
              <Text style={styles.pendingMeta}>
                {p.completed ? 'Completed' : 'In progress'} · {p.archived ? 'Archived' : 'Active'}
              </Text>
            </TouchableOpacity>
            {p.completed ? (
              <TouchableOpacity
                style={[styles.approveBtn, archiveMutation.isPending && styles.buttonDisabled]}
                onPress={() => archiveMutation.mutate({ id: p.id, archived: !p.archived })}
              >
                <Text style={styles.approveBtnText}>{p.archived ? 'Unarchive' : 'Archive'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.approvalCard}>
        <Text style={styles.sectionTitle}>My recent submissions</Text>
        {mySubmissions.length === 0 ? (
          <Text style={styles.empty}>No submissions yet.</Text>
        ) : (
          mySubmissions.map((item) => (
            <TouchableOpacity key={item.id} style={styles.pendingItem} onPress={() => setSelectedCompletion(item)}>
              <Text style={styles.pendingDesc}>{item.description}</Text>
              <Text style={styles.pendingMeta}>
                Status:{' '}
                {item.status === 'approved'
                  ? 'Admin final approval complete - project can be archived'
                  : item.status === 'supervisor_approved'
                    ? 'Supervisor approved - awaiting admin final approval'
                    : 'Pending supervisor approval'}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
      <Modal visible={!!selectedCompletion} transparent animationType="slide" onRequestClose={() => setSelectedCompletion(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedCompletion ? (
              <>
                <Text style={styles.sectionTitle}>Review job completion</Text>
                <Text style={styles.pendingDesc}>{selectedCompletion.description}</Text>
                <Text style={styles.pendingMeta}>Status: {selectedCompletion.status}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalPhotos}>
                  {selectedCompletion.photo_urls.map((uri, index) => (
                    <Image key={`${selectedCompletion.id}-${index}`} source={{ uri }} style={styles.modalPhoto} />
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.approveBtn} onPress={() => setSelectedCompletion(null)}>
                  <Text style={styles.approveBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#4a026f', marginBottom: 16 },
  subtitle: { fontSize: 13, color: '#707173', marginBottom: 10 },
  projectBtn: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  projectText: { fontSize: 14, color: '#4a026f' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#4a026f', marginTop: 16, marginBottom: 8 },
  buttonDisabled: { opacity: 0.6 },
  approvalCard: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  pendingItem: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  pendingDesc: { fontSize: 13, color: '#333', marginBottom: 4 },
  pendingMeta: { fontSize: 12, color: '#707173', marginBottom: 8 },
  approveBtn: {
    backgroundColor: '#4a026f',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  approveBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { color: '#707173', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 14,
    maxHeight: '80%',
  },
  modalPhotos: { marginVertical: 10 },
  modalPhoto: { width: 140, height: 140, borderRadius: 8, marginRight: 8, backgroundColor: '#eee' },
});
