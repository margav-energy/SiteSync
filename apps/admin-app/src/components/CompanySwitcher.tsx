import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCompanyContext } from '@staff4dshire/shared';
import type { Company } from '@staff4dshire/shared';

export function CompanySwitcher() {
  const { companies, activeCompany, setActiveCompanyId, loading } = useCompanyContext();
  const [open, setOpen] = useState(false);

  if (loading && !companies.length) {
    return (
      <View style={styles.pad}>
        <ActivityIndicator color="#fff" size="small" />
      </View>
    );
  }

  if (companies.length <= 1) {
    return null;
  }

  const onSelect = async (c: Company) => {
    setOpen(false);
    if (c.id !== activeCompany?.id) {
      await setActiveCompanyId(c.id);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        accessibilityRole="button"
        accessibilityLabel="Switch organisation"
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {activeCompany?.name ?? 'Organisation'}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#fff" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Work in organisation</Text>
            <FlatList
              data={companies}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => void onSelect(item)}
                >
                  <Text style={styles.rowText}>{item.name}</Text>
                  {item.id === activeCompany?.id ? (
                    <Ionicons name="checkmark-circle" size={22} color="#4a026f" />
                  ) : null}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 8, justifyContent: 'center' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 160,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
  },
  triggerPressed: { opacity: 0.85 },
  triggerText: { color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '70%',
    paddingVertical: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a026f',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
  },
  rowText: { fontSize: 15, color: '#333', flex: 1, paddingRight: 8 },
});
