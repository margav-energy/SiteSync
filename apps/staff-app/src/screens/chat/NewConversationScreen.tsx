import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@staff4dshire/shared';
import { usersService, chatService } from '@staff4dshire/shared';
import type { User } from '@staff4dshire/shared';
import type { ChatStackParamList } from '../../navigation/ChatStack';

type Nav = NativeStackNavigationProp<ChatStackParamList, 'NewConversation'>;

export function NewConversationScreen() {
  const { user } = useAuthContext();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
  });

  const canCurrentUserSeeTarget = (target: User) => {
    if (target.role !== 'superadmin') return true;
    return user?.role === 'admin';
  };

  const others = users.filter((u) => u.id !== user?.id && u.is_active && canCurrentUserSeeTarget(u));

  const createMutation = useMutation({
    mutationFn: async ({ peerId, title }: { peerId: string; title: string }) => {
      const conv = await chatService.createConversation([peerId]);
      return { conv, title };
    },
    onSuccess: ({ conv, title }) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      navigation.replace('ChatConversation', { conversationId: conv.id, title });
    },
    onError: (e: Error) => Alert.alert('Could not start chat', e.message || 'Try again'),
  });

  const renderItem = ({ item }: { item: User }) => (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() =>
        createMutation.mutate({
          peerId: item.id,
          title: `${item.first_name} ${item.last_name}`.trim(),
        })
      }
      disabled={createMutation.isPending}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.first_name?.[0] ?? '?').toUpperCase()}
          {(item.last_name?.[0] ?? '').toUpperCase()}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name}>
          {item.first_name} {item.last_name}
        </Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      <Ionicons name="chatbubble-ellipses-outline" size={22} color="#4a026f" />
    </Pressable>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4a026f" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>Choose a colleague to start a direct message.</Text>
      <FlatList
        data={others}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>No other users in your organisation yet.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { fontSize: 14, color: '#707173', marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  rowPressed: { opacity: 0.85 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0e6f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#4a026f' },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#333' },
  email: { fontSize: 13, color: '#707173', marginTop: 2 },
  empty: { textAlign: 'center', color: '#897c98', marginTop: 40 },
});
