import React from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext, getStoredActiveProjectId } from '@staff4dshire/shared';
import { timesheetsService, usersService, projectsService } from '@staff4dshire/shared';
import type { TimeEntry, User, Project } from '@staff4dshire/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type EntryItemProps = {
  item: TimeEntry;
  isSupervisorView: boolean;
  staffName?: string;
  projectName?: string;
  approvedByLabel?: string;
  onApprove?: (id: string) => void;
  approving: boolean;
  onOpen: (item: TimeEntry) => void;
};

function EntryItem({ item, isSupervisorView, staffName, projectName, approvedByLabel, onApprove, approving, onOpen }: EntryItemProps) {
  const signOut = item.sign_out_at ? new Date(item.sign_out_at).toLocaleTimeString() : '—';
  const isCompleted = !!item.sign_out_at;
  const isApproved = !!item.approved_at;
  return (
    <Pressable style={styles.item} onPress={() => onOpen(item)}>
      {isSupervisorView ? (
        <>
          <Text style={styles.heading}>{staffName ?? 'Staff'}</Text>
          <Text style={styles.meta}>Project: {projectName ?? 'Unknown project'}</Text>
        </>
      ) : null}
      <Text style={styles.time}>In: {new Date(item.sign_in_at).toLocaleString()}</Text>
      {item.sign_in_address ? <Text style={styles.time}>Sign-in origin: {item.sign_in_address}</Text> : null}
      {item.arrived_at ? (
        <Text style={styles.time}>
          Arrived on site: {new Date(item.arrived_at).toLocaleString()} ({item.travel_minutes ?? 0} min,{' '}
          {(item.travel_miles ?? 0).toFixed(2)} miles)
        </Text>
      ) : null}
      <Text style={styles.time}>Out: {signOut}</Text>
      <Text style={styles.status}>
        Status:{' '}
        {isApproved
          ? `Approved (${new Date(item.approved_at!).toLocaleString()})`
          : isCompleted
            ? 'Awaiting approval'
            : 'Open shift'}
      </Text>
      {isApproved ? <Text style={styles.approvedBy}>Approved by: {approvedByLabel ?? 'Unknown'}</Text> : null}
      <Text style={styles.tapHint}>Tap to review full timesheet</Text>
      {isSupervisorView && isCompleted && !isApproved ? (
        <Pressable
          style={({ pressed }) => [styles.approveBtn, pressed && { opacity: 0.85 }]}
          onPress={() => onApprove?.(item.id)}
          disabled={approving}
        >
          {approving ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveText}>Approve timesheet</Text>}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function TimesheetsScreen() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const isSupervisorView = user?.role === 'supervisor';
  const [selected, setSelected] = React.useState<TimeEntry | null>(null);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isSupervisorView) {
      setActiveProjectId(null);
      return;
    }
    void (async () => {
      const stored = await getStoredActiveProjectId();
      setActiveProjectId(stored);
    })();
  }, [isSupervisorView]);

  const { data: ownEntries = [], isLoading: isLoadingOwn } = useQuery({
    queryKey: ['timesheets', user?.id],
    queryFn: () => timesheetsService.getByUserId(user!.id),
    enabled: !!user?.id && !isSupervisorView,
  });

  const { data: teamEntries = [], isLoading: isLoadingTeam } = useQuery({
    queryKey: ['timesheets', 'supervisor', user?.id],
    queryFn: () => timesheetsService.getAll(),
    enabled: !!user?.id && isSupervisorView,
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
    enabled: !!user?.id,
  });

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getAll(),
    enabled: isSupervisorView,
  });

  const approveMutation = useMutation({
    mutationFn: (timeEntryId: string) => timesheetsService.approve(timeEntryId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['timesheets', 'supervisor', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['timesheets', user?.id] }),
      ]);
    },
    onError: (error: unknown) => {
      Alert.alert('Approval failed', error instanceof Error ? error.message : 'Unable to approve timesheet');
    },
  });

  const filteredSupervisorEntries = React.useMemo(() => {
    if (!isSupervisorView || !user?.id) return [];
    const supervisedProjectIds = new Set(
      projects.filter((project: Project) => project.supervisor_id === user.id).map((project: Project) => project.id)
    );
    return teamEntries
      .filter((entry) => supervisedProjectIds.has(entry.project_id))
      .filter((entry) => (activeProjectId ? entry.project_id === activeProjectId : true))
      .sort((a, b) => new Date(b.sign_in_at).getTime() - new Date(a.sign_in_at).getTime());
  }, [isSupervisorView, user?.id, teamEntries, projects, activeProjectId]);

  const data = isSupervisorView ? filteredSupervisorEntries : ownEntries;
  const isLoading = isSupervisorView
    ? isLoadingTeam || isLoadingUsers || isLoadingProjects
    : isLoadingOwn;

  const userMap = React.useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const projectMap = React.useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  if (isLoading) return <View style={styles.centered}><Text>Loading...</Text></View>;

  return (
    <View style={styles.container}>
      {isSupervisorView ? (
        <Text style={styles.screenTitle}>
          Team timesheets awaiting your oversight
          {activeProjectId ? ` · ${projectMap.get(activeProjectId)?.name ?? 'Selected project'}` : ''}
        </Text>
      ) : null}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EntryItem
            item={item}
            isSupervisorView={isSupervisorView}
            staffName={
              isSupervisorView
                ? `${userMap.get(item.user_id)?.first_name ?? ''} ${userMap.get(item.user_id)?.last_name ?? ''}`.trim() ||
                  userMap.get(item.user_id)?.email
                : undefined
            }
            projectName={isSupervisorView ? projectMap.get(item.project_id)?.name : undefined}
            approvedByLabel={
              item.approved_by_user_id
                ? `${userMap.get(item.approved_by_user_id)?.first_name ?? ''} ${userMap.get(item.approved_by_user_id)?.last_name ?? ''}`.trim() ||
                  userMap.get(item.approved_by_user_id)?.email
                : undefined
            }
            onApprove={(id) => approveMutation.mutate(id)}
            approving={approveMutation.isPending && approveMutation.variables === item.id}
            onOpen={setSelected}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isSupervisorView
              ? activeProjectId
                ? 'No timesheets pending for the selected project.'
                : 'No timesheets for your supervised projects yet.'
              : 'No timesheets found.'}
          </Text>
        }
      />
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selected ? (
              <>
                <Text style={styles.modalTitle}>Timesheet review</Text>
                {isSupervisorView ? (
                  <>
                    <Text style={styles.modalMeta}>
                      Staff:{' '}
                      {`${userMap.get(selected.user_id)?.first_name ?? ''} ${userMap.get(selected.user_id)?.last_name ?? ''}`.trim() ||
                        userMap.get(selected.user_id)?.email ||
                        'Unknown'}
                    </Text>
                    <Text style={styles.modalMeta}>Project: {projectMap.get(selected.project_id)?.name ?? 'Unknown project'}</Text>
                  </>
                ) : null}
                <ScrollView style={styles.modalScroll}>
                  <Text style={styles.modalMeta}>Sign in: {new Date(selected.sign_in_at).toLocaleString()}</Text>
                  <Text style={styles.modalMeta}>Sign out: {selected.sign_out_at ? new Date(selected.sign_out_at).toLocaleString() : '—'}</Text>
                  <Text style={styles.modalMeta}>Sign-in origin: {selected.sign_in_address ?? '—'}</Text>
                  <Text style={styles.modalMeta}>Arrival: {selected.arrived_at ? new Date(selected.arrived_at).toLocaleString() : '—'}</Text>
                  <Text style={styles.modalMeta}>
                    Travel: {selected.travel_minutes ?? 0} min / {(selected.travel_miles ?? 0).toFixed(2)} miles
                  </Text>
                  <Text style={styles.modalMeta}>
                    Status: {selected.approved_at ? `Approved (${new Date(selected.approved_at).toLocaleString()})` : selected.sign_out_at ? 'Awaiting approval' : 'Open shift'}
                  </Text>
                </ScrollView>
                {isSupervisorView && selected.sign_out_at && !selected.approved_at ? (
                  <Pressable
                    style={({ pressed }) => [styles.approveBtn, pressed && { opacity: 0.85 }, approvingDisabled(approveMutation.isPending)]}
                    onPress={() => approveMutation.mutate(selected.id)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveText}>Approve timesheet</Text>}
                  </Pressable>
                ) : null}
                <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function approvingDisabled(disabled: boolean) {
  return disabled ? { opacity: 0.6 } : null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  screenTitle: { fontSize: 16, fontWeight: '700', color: '#4a026f', marginBottom: 12 },
  item: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  heading: { fontSize: 15, fontWeight: '700', color: '#2f2f2f' },
  meta: { fontSize: 13, color: '#6d6d6d', marginTop: 2 },
  time: { fontSize: 14, color: '#707173', marginTop: 4 },
  status: { fontSize: 13, color: '#4a026f', marginTop: 8, fontWeight: '600' },
  approvedBy: { fontSize: 12, color: '#5b4f66', marginTop: 4 },
  tapHint: { fontSize: 12, color: '#4a026f', marginTop: 8, fontWeight: '600' },
  approveBtn: {
    marginTop: 10,
    backgroundColor: '#4a026f',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#707173', marginTop: 24, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#4a026f', marginBottom: 10 },
  modalScroll: { maxHeight: 320 },
  modalMeta: { fontSize: 13, color: '#444', marginBottom: 8 },
  closeBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#4a026f',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeText: { color: '#4a026f', fontWeight: '600' },
});
