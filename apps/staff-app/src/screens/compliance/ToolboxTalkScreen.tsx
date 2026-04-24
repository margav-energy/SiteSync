import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatService, useAuthContext, usersService } from '@staff4dshire/shared';

export function ToolboxTalkScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const [draft, setDraft] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['toolbox-discussion'],
    queryFn: () => chatService.getToolboxDiscussion(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
  });
  const messages = data?.messages ?? [];

  const postMutation = useMutation({
    mutationFn: async (content: string) => chatService.postToolboxMessage(content),
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['toolbox-discussion'] });
    },
    onError: (e: Error) => Alert.alert('Post failed', e.message || 'Try again.'),
  });

  const archiveMutation = useMutation({
    mutationFn: async (archive: boolean) => chatService.archiveToolboxDiscussion(archive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['toolbox-discussion'] });
    },
  });

  const send = () => {
    const msg = draft.trim();
    if (!msg) return;
    postMutation.mutate(msg);
  };

  const authorNameById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, `${u.first_name} ${u.last_name}`.trim()));
    return map;
  }, [users]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4a026f" />
      </View>
    );
  }

  if (data?.archived) {
    return (
      <View style={[styles.container, styles.content]}>
        <Text style={styles.lead}>This Toolbox Talk discussion is archived for you.</Text>
        <TouchableOpacity style={styles.sendBtn} onPress={() => archiveMutation.mutate(false)}>
          <Text style={styles.sendText}>Unarchive discussion</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        Toolbox Talk is now a team discussion channel. Any role can open discussions, share safety points, and track
        actions for the day.
      </Text>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Start a safety discussion..."
          placeholderTextColor="#897c98"
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={postMutation.isPending}>
          <Text style={styles.sendText}>{postMutation.isPending ? 'Posting...' : 'Post'}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.archiveBtn} onPress={() => archiveMutation.mutate(true)}>
        <Text style={styles.archiveText}>Archive discussion</Text>
      </TouchableOpacity>
      {messages.map((t) => (
        <View key={t.id} style={styles.card}>
          <Text style={styles.title}>
            {t.sender_id === user?.id ? 'You' : authorNameById.get(t.sender_id) ?? 'Team member'}
          </Text>
          <Text style={styles.status}>{t.content || '[Attachment]'}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  lead: { fontSize: 14, color: '#707173', lineHeight: 20, marginBottom: 16 },
  composer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 12,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    minHeight: 70,
    padding: 10,
    fontSize: 14,
    color: '#333',
  },
  sendBtn: {
    marginTop: 10,
    backgroundColor: '#4a026f',
    borderRadius: 8,
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sendText: { color: '#fff', fontWeight: '700' },
  archiveBtn: {
    marginBottom: 10,
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8cde5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  archiveText: { color: '#4a026f', fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  title: { fontSize: 16, fontWeight: '600', color: '#333' },
  status: { fontSize: 13, color: '#897c98', marginTop: 6 },
});
