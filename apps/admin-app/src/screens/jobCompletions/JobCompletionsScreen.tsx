import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, Image, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobCompletionsService } from '@staff4dshire/shared';
import type { JobCompletion } from '@staff4dshire/shared';

function JobItem({
  item,
  onOpen,
}: {
  item: JobCompletion;
  onOpen: (item: JobCompletion) => void;
}) {
  return (
    <TouchableOpacity style={styles.item} onPress={() => onOpen(item)} activeOpacity={0.8}>
      <Text style={styles.desc}>{item.description}</Text>
      <Text style={styles.status}>{item.status}</Text>
      <Text style={styles.tapHint}>Tap to review details and photos</Text>
    </TouchableOpacity>
  );
}

export function JobCompletionsScreen() {
  const [selected, setSelected] = useState<JobCompletion | null>(null);
  const queryClient = useQueryClient();
  const { data: completions = [], isLoading } = useQuery({
    queryKey: ['job-completions'],
    queryFn: () => jobCompletionsService.getAll(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => jobCompletionsService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-completions'] });
      Alert.alert('Success', 'Approval step completed');
      setSelected(null);
    },
  });

  if (isLoading) return <View style={styles.centered}><Text>Loading...</Text></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={completions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <JobItem item={item} onOpen={setSelected} />
        )}
      />
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selected ? (
              <>
                <Text style={styles.modalTitle}>Review job completion</Text>
                <Text style={styles.modalDesc}>{selected.description}</Text>
                <Text style={styles.modalMeta}>Status: {selected.status}</Text>
                <Text style={styles.modalMeta}>Photos: {selected.photo_urls.length}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                  {selected.photo_urls.map((uri, index) => (
                    <Image key={`${selected.id}-${index}`} source={{ uri }} style={styles.photo} />
                  ))}
                </ScrollView>
                {selected.status !== 'approved' ? (
                  <TouchableOpacity
                    style={[styles.approveBtn, approveMutation.isPending && styles.buttonDisabled]}
                    onPress={() => approveMutation.mutate(selected.id)}
                    disabled={approveMutation.isPending}
                  >
                    <Text style={styles.approveText}>
                      {selected.status === 'pending' ? 'Supervisor sign-off' : 'Admin final approval'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  item: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  desc: { fontSize: 14, color: '#4a026f' },
  status: { fontSize: 12, color: '#707173', marginTop: 4 },
  tapHint: { fontSize: 12, color: '#4a026f', marginTop: 8, fontWeight: '600' },
  approveBtn: {
    backgroundColor: '#4a026f',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  buttonDisabled: { opacity: 0.6 },
  approveText: { color: '#fff', fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#4a026f' },
  modalDesc: { marginTop: 10, fontSize: 14, color: '#333' },
  modalMeta: { marginTop: 6, fontSize: 12, color: '#707173' },
  photoRow: { marginTop: 12, marginBottom: 10 },
  photo: { width: 140, height: 140, borderRadius: 8, marginRight: 10, backgroundColor: '#eee' },
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
