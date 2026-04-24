import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companiesService, useAuthContext, useCompanyContext, hasCapability } from '@staff4dshire/shared';
import type { Company } from '@staff4dshire/shared';

function CompanyItem({ item, active }: { item: Company; active: boolean }) {
  return (
    <View style={[styles.item, active && styles.itemActive]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>
          {item.is_archived ? 'Archived' : item.is_suspended ? 'Suspended' : item.is_active ? 'Active' : 'Inactive'}
        </Text>
      </View>
      {active ? <Text style={styles.badge}>Selected</Text> : null}
    </View>
  );
}

export function CompaniesScreen() {
  const { user } = useAuthContext();
  const { activeCompanyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const canCreate = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperadmin = user?.role === 'superadmin';

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: async (n: string) => companiesService.create({ name: n }),
    onSuccess: async () => {
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (e: unknown) => {
      const msg = e && typeof e === 'object' && 'response' in e ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error) : 'Failed to create';
      Alert.alert('Create company', msg || 'Failed to create');
    },
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4a026f" />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {canCreate && hasCapability(user?.role, 'manage_companies') ? (
        <View style={styles.createRow}>
          <TextInput
            style={styles.input}
            placeholder="New organisation name"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
          />
          <Pressable
            style={[styles.createBtn, (!name.trim() || createMutation.isPending) && styles.createBtnDisabled]}
            disabled={!name.trim() || createMutation.isPending}
            onPress={() => createMutation.mutate(name.trim())}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.createBtnText}>Create</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.hint}>
        Switch the active organisation from the header on any Home screen. Each company has its own users, projects, and
        data.
      </Text>

      <FlatList
        data={companies}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <CompanyItem item={item} active={item.id === activeCompanyId} />
            {isSuperadmin ? (
              <View style={styles.rowActions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() =>
                    companiesService
                      .updateStatus(item.id, { is_suspended: !item.is_suspended })
                      .then(() => queryClient.invalidateQueries({ queryKey: ['companies'] }))
                  }
                >
                  <Text style={styles.actionText}>{item.is_suspended ? 'Unsuspend' : 'Suspend'}</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() =>
                    companiesService
                      .updateStatus(item.id, { is_archived: !item.is_archived })
                      .then(() => queryClient.invalidateQueries({ queryKey: ['companies'] }))
                  }
                >
                  <Text style={styles.actionText}>{item.is_archived ? 'Unarchive' : 'Archive'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { marginTop: 8, color: '#707173' },
  createRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    fontSize: 15,
  },
  createBtn: {
    backgroundColor: '#4a026f',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 88,
    alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { fontSize: 13, color: '#707173', marginBottom: 12, lineHeight: 18 },
  item: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  itemActive: { borderColor: '#4a026f', backgroundColor: '#f9f5fc' },
  name: { fontSize: 16, fontWeight: '600', color: '#4a026f', flex: 1 },
  meta: { fontSize: 12, color: '#707173', marginTop: 4 },
  badge: { fontSize: 12, fontWeight: '700', color: '#4a026f' },
  rowActions: { flexDirection: 'row', gap: 8, marginBottom: 10, marginTop: -2 },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#c6b4d3',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: { color: '#4a026f', fontSize: 12, fontWeight: '600' },
});
