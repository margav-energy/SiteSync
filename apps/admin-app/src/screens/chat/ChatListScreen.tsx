import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
  TextInput,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthContext } from '@staff4dshire/shared';
import { chatService, usersService, chatLastMessagePreview } from '@staff4dshire/shared';
import type { Conversation, User } from '@staff4dshire/shared';
import type { ChatStackParamList } from '../../navigation/ChatStack';

type Nav = NativeStackNavigationProp<ChatStackParamList, 'ChatList'>;

/** Normalize API field + bust stale cache rows missing counts. */
function conversationUnreadCount(conv: Conversation): number {
  const c = conv as Conversation & { unreadCount?: number };
  const raw = c.unread_count ?? c.unreadCount;
  if (raw == null) return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function conversationTitle(conv: Conversation, meId: string | undefined, users: User[]): string {
  if (!meId) return 'Chat';
  const others = conv.participants.filter((id) => id !== meId);
  if (others.length === 0) return 'Just you';
  if (others.length === 1) {
    const u = users.find((x) => x.id === others[0]);
    return u ? `${u.first_name} ${u.last_name}`.trim() : 'Chat';
  }
  return `Group (${conv.participants.length})`;
}

function formatListTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate()
    ) {
      return 'Yesterday';
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function conversationActivityAt(conv: Conversation): string | undefined {
  return conv.last_message?.created_at ?? conv.updated_at;
}

function conversationActivityMs(conv: Conversation): number {
  const raw = conversationActivityAt(conv);
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function ListAvatar({ user, group }: { user: User | null; group: boolean }) {
  if (group) {
    return (
      <View style={[styles.dp, styles.dpGroup]}>
        <Text style={styles.dpGroupText}>#</Text>
      </View>
    );
  }
  const url = user?.photo_url;
  const size = 52;
  const r = size / 2;
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: r }} />;
  }
  const initials =
    user && (user.first_name || user.last_name)
      ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
      : '?';
  return (
    <View style={[styles.dp, styles.dpPlaceholder]}>
      <Text style={styles.dpInitials}>{initials}</Text>
    </View>
  );
}

function GlassChatCard({
  pressed,
  children,
}: {
  pressed: boolean;
  children: React.ReactNode;
}) {
  const common = [styles.glassInner, pressed && styles.glassPressed];
  if (Platform.OS === 'web') {
    return <View style={[styles.glassWeb, ...common]}>{children}</View>;
  }
  return (
    <BlurView intensity={52} tint="light" style={[styles.glassBlur, ...common]}>
      {children}
    </BlurView>
  );
}

function ConversationItem({
  item,
  title,
  avatarUser,
  isGroup,
  unreadCount,
  onPress,
  onLongPress,
}: {
  item: Conversation;
  title: string;
  avatarUser: User | null;
  isGroup: boolean;
  unreadCount: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const preview = item.last_message
    ? chatLastMessagePreview(item.last_message.content, item.last_message.attachment_url)
    : 'No messages yet';
  const timeStr = formatListTime(conversationActivityAt(item));
  const badge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.itemWrap}>
      {({ pressed }) => (
        <GlassChatCard pressed={pressed}>
          <View style={styles.row}>
            <ListAvatar user={avatarUser} group={isGroup} />
            <View style={styles.mid}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.preview} numberOfLines={2}>
                {preview}
              </Text>
            </View>
            <View style={styles.rightCol}>
              <Text style={styles.time}>{timeStr}</Text>
              {badge ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{badge}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </GlassChatCard>
      )}
    </Pressable>
  );
}

export function ChatListScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const uid = user?.id ?? '';
  const [searchQuery, setSearchQuery] = useState('');
  const searchTerm = searchQuery.trim();

  const { data: conversations = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['chat', 'conversations', uid],
    queryFn: () => chatService.getConversations(),
    enabled: Boolean(uid),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
  });
  const { data: matchedConversationIds = [] } = useQuery({
    queryKey: ['chat', 'search', uid, searchTerm],
    queryFn: () => chatService.searchConversations(searchTerm),
    enabled: Boolean(uid) && searchTerm.length >= 2,
  });
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) => chatService.deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: (e: Error) => Alert.alert('Delete failed', e.message || 'Try again'),
  });

  const confirmDeleteConversation = useCallback(
    (conversationId: string) => {
      Alert.alert('Delete conversation', 'This will permanently delete this conversation for participants.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteConversationMutation.mutate(conversationId),
        },
      ]);
    },
    [deleteConversationMutation]
  );

  const openConversationActions = useCallback(
    (conversationId: string) => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Delete conversation'],
            cancelButtonIndex: 0,
            destructiveButtonIndex: 1,
          },
          (idx) => {
            if (idx === 1) confirmDeleteConversation(conversationId);
          }
        );
        return;
      }
      confirmDeleteConversation(conversationId);
    },
    [confirmDeleteConversation]
  );

  const rows = useMemo(() => {
    const meId = user?.id;
    const baseRows = conversations
      .slice()
      .sort((a, b) => conversationActivityMs(b) - conversationActivityMs(a))
      .map((c) => {
        const others = meId ? c.participants.filter((id) => id !== meId) : [];
        const title = conversationTitle(c, meId, users);
        const isGroup = others.length > 1;
        const avatarUser = !isGroup && others[0] ? users.find((u) => u.id === others[0]) ?? null : null;
        return { conv: c, title, avatarUser, isGroup };
      });
    const dedupedRows = baseRows.filter((row, index, all) => {
      if (!meId) return true;
      if (row.isGroup) return true;
      const others = row.conv.participants.filter((id) => id !== meId);
      const otherId = others[0];
      if (!otherId) return true;
      return (
        index ===
        all.findIndex((r) => {
          const rOthers = r.conv.participants.filter((id) => id !== meId);
          return !r.isGroup && rOthers[0] === otherId;
        })
      );
    });
    const q = searchQuery.trim().toLowerCase();
    if (!q) return dedupedRows;
    const backendMatches = new Set(matchedConversationIds);
    return dedupedRows.filter((r) => {
      if (backendMatches.has(r.conv.id)) return true;
      const preview = r.conv.last_message
        ? chatLastMessagePreview(r.conv.last_message.content, r.conv.last_message.attachment_url)
        : '';
      return `${r.title} ${preview}`.toLowerCase().includes(q);
    });
  }, [conversations, user?.id, users, searchQuery, matchedConversationIds]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4a026f" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search people or messages"
          placeholderTextColor="#7c7388"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.conv.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#4a026f" />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No conversations yet. Use the compose button in the header to start one.</Text>
        }
        renderItem={({ item: r }) => (
          <ConversationItem
            item={r.conv}
            title={r.title}
            avatarUser={r.avatarUser}
            isGroup={r.isGroup}
            unreadCount={conversationUnreadCount(r.conv)}
            onPress={() =>
              navigation.navigate('ChatConversation', {
                conversationId: r.conv.id,
                title: r.title,
              })
            }
            onLongPress={() => openConversationActions(r.conv.id)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#dcd2e8',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#dcd2e8' },
  searchWrap: { marginBottom: 10 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 2, 111, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#2f2140',
    fontSize: 14,
  },
  itemWrap: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#2d1b3d',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 24px rgba(45, 27, 61, 0.12)' } as object,
    }),
  },
  glassBlur: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.35)' : undefined,
  },
  glassWeb: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
  },
  glassInner: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  glassPressed: {
    opacity: 0.92,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  dp: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    overflow: 'hidden',
  },
  dpPlaceholder: {
    backgroundColor: '#c5b8d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpInitials: { fontSize: 18, fontWeight: '700', color: '#4a026f' },
  dpGroup: {
    backgroundColor: 'rgba(196, 181, 212, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpGroupText: { fontSize: 22, fontWeight: '700', color: '#4a026f' },
  mid: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '600', color: '#4a026f' },
  preview: { fontSize: 14, color: '#4a4458', marginTop: 4 },
  rightCol: { alignItems: 'flex-end', marginLeft: 8, minWidth: 48 },
  time: { fontSize: 12, color: '#5c5368' },
  unreadBadge: {
    marginTop: 6,
    minWidth: 24,
    minHeight: 22,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#c62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  empty: { textAlign: 'center', color: '#5c5368', marginTop: 48, paddingHorizontal: 24 },
});
