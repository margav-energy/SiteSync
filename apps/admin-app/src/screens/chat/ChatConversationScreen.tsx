import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  Alert,
  ActionSheetIOS,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import {
  chatService,
  getSocket,
  useAuthContext,
  setActiveChatConversationId,
  uploadsService,
  isImageAttachmentUrl,
  resolvePublicFileUrl,
  formatChatPresence,
  usersService,
} from '@staff4dshire/shared';
import type { Message, User } from '@staff4dshire/shared';
import type { ChatStackParamList } from '../../navigation/ChatStack';

type Route = RouteProp<ChatStackParamList, 'ChatConversation'>;

const WA_BG = '#ECE5DD';
const BUBBLE_SENT = '#DCF8C6';
const BUBBLE_RECV = '#FFFFFF';
const ACCENT = '#25D366';
const HEADER_BG = '#4a026f';

type PendingFile = { uri: string; name: string; mime: string };

const maxImageWidth = Math.min(260, Dimensions.get('window').width * 0.5);

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function fileLabelFromUrl(url: string): string {
  try {
    const last = decodeURIComponent(url.split('/').pop() || 'file');
    return last.length > 28 ? `${last.slice(0, 25)}…` : last;
  } catch {
    return 'File';
  }
}

function conversationTitle(conv: { participants: string[] }, meId: string | undefined, users: User[]): string {
  if (!meId) return 'Chat';
  const others = conv.participants.filter((id) => id !== meId);
  if (others.length === 0) return 'Just you';
  if (others.length === 1) {
    const u = users.find((x) => x.id === others[0]);
    return u ? `${u.first_name} ${u.last_name}`.trim() : 'Chat';
  }
  return `Group (${conv.participants.length})`;
}

function UserAvatar({ user, size }: { user: User | null | undefined; size: number }) {
  const url = user?.photo_url;
  const r = size / 2;
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: r, backgroundColor: '#ddd' }}
      />
    );
  }
  const initials =
    user && (user.first_name || user.last_name)
      ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
      : '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: '#c5b8d4',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.36, fontWeight: '700', color: '#4a026f' }}>{initials}</Text>
    </View>
  );
}

export function ChatConversationScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { conversationId, title: routeTitle } = route.params;
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardToastVisible, setForwardToastVisible] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: () => chatService.getMessages(conversationId),
  });

  useEffect(() => {
    if (!forwardToastVisible) return;
    const id = setTimeout(() => setForwardToastVisible(false), 1800);
    return () => clearTimeout(id);
  }, [forwardToastVisible]);

  useEffect(() => {
    if (!user?.id || !messages.length) return;
    const uid = user.id;
    const unread = messages.filter((m) => {
      const readers = Array.isArray(m.read_by) ? m.read_by : [];
      return m.sender_id !== uid && !readers.includes(uid);
    });
    if (unread.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        await Promise.all(unread.map((m) => chatService.markMessageRead(m.id)));
        if (cancelled) return;
        queryClient.setQueryData<Message[]>(['chat', 'messages', conversationId], (prev) => {
          if (!prev) return prev;
          return prev.map((msg) => {
            if (msg.sender_id === uid) return msg;
            const readers = Array.isArray(msg.read_by) ? [...msg.read_by] : [];
            if (readers.includes(uid)) return msg;
            return { ...msg, read_by: [...readers, uid] };
          });
        });
        await queryClient.refetchQueries({ queryKey: ['chat', 'unread-count', uid] });
        await queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      } catch {
        // refetch from server on next focus / invalidate
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, user?.id, conversationId, queryClient]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['chat', 'conversations', user?.id ?? ''],
    queryFn: () => chatService.getConversations(),
    enabled: Boolean(user?.id),
  });

  const usersById = useMemo(() => {
    const m: Record<string, User> = {};
    for (const u of users) m[u.id] = u;
    return m;
  }, [users]);

  const conv = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId]
  );

  const headerInfo = useMemo(() => {
    const meId = user?.id;
    const others = (conv?.participants ?? []).filter((id) => id !== meId);
    if (others.length === 1) {
      const u = usersById[others[0]];
      return {
        title: u ? `${u.first_name} ${u.last_name}`.trim() : routeTitle ?? 'Chat',
        subtitle: formatChatPresence(u?.last_login_at),
        avatarUser: u ?? null,
        isGroup: false,
      };
    }
    if (others.length > 1) {
      return {
        title: routeTitle ?? `Group (${conv?.participants.length ?? 0})`,
        subtitle: `${others.length} people`,
        avatarUser: usersById[others[0]] ?? null,
        isGroup: true,
      };
    }
    return {
      title: routeTitle ?? 'Chat',
      subtitle: '',
      avatarUser: null as User | null,
      isGroup: false,
    };
  }, [conv, usersById, user?.id, routeTitle]);

  useFocusEffect(
    useCallback(() => {
      setActiveChatConversationId(conversationId);
      const socket = getSocket();
      const join = () => socket?.emit('join-conversation', conversationId);
      join();
      socket?.on('connect', join);
      return () => {
        setActiveChatConversationId(null);
        socket?.off('connect', join);
        socket?.emit('leave-conversation', conversationId);
        if (user?.id) {
          void queryClient.invalidateQueries({ queryKey: ['chat', 'unread-count', user.id] });
        }
      };
    }, [conversationId, queryClient, user?.id])
  );

  const sendMutation = useMutation({
    mutationFn: async (vars: { caption: string; file?: PendingFile | null }) => {
      let attachmentUrl: string | undefined;
      if (vars.file) {
        attachmentUrl = await uploadsService.uploadChatAttachment({
          uri: vars.file.uri,
          name: vars.file.name,
          type: vars.file.mime,
        });
      }
      const caption = vars.caption.trim();
      return chatService.sendMessage(conversationId, caption, attachmentUrl);
    },
    onSuccess: () => {
      setDraft('');
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: (e: Error) => {
      Alert.alert('Could not send', e.message || 'Try again');
    },
  });

  const editMutation = useMutation({
    mutationFn: (vars: { id: string; content: string }) => chatService.editMessage(vars.id, vars.content),
    onSuccess: () => {
      setDraft('');
      setEditingMessage(null);
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: (e: Error) => Alert.alert('Could not edit message', e.message || 'Try again'),
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id: string) => chatService.deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: (e: Error) => Alert.alert('Could not delete message', e.message || 'Try again'),
  });
  const forwardMutation = useMutation({
    mutationFn: (vars: { targetConversationId: string; message: Message }) =>
      chatService.sendMessage(vars.targetConversationId, vars.message.content ?? '', vars.message.attachment_url),
    onSuccess: () => {
      setForwardingMessage(null);
      setForwardToastVisible(true);
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
    },
    onError: (e: Error) => Alert.alert('Could not forward message', e.message || 'Try again'),
  });

  const canSend = editingMessage
    ? Boolean(draft.trim()) && !editMutation.isPending
    : (Boolean(draft.trim()) || Boolean(pending)) && !sendMutation.isPending;

  const quoteForReply = useCallback((msg: Message) => {
    const raw = msg.content?.trim() || (msg.attachment_url ? 'Attachment' : 'Message');
    return raw.length > 60 ? `${raw.slice(0, 57)}...` : raw;
  }, []);

  const sendNow = () => {
    if (!canSend) return;
    if (editingMessage) {
      editMutation.mutate({ id: editingMessage.id, content: draft.trim() });
      return;
    }
    const trimmed = draft.trim();
    const caption = replyTo
      ? `Replying to "${quoteForReply(replyTo)}"\n${trimmed}`.trim()
      : trimmed;
    sendMutation.mutate({ caption, file: pending });
    setReplyTo(null);
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', useCamera ? 'Camera access is required.' : 'Photo library access is required.');
        return;
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
          });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
      const mime = asset.mimeType ?? 'image/jpeg';
      setPending({ uri: asset.uri, name, mime });
    } catch (e) {
      Alert.alert('Image', (e as Error).message ?? 'Could not open image picker');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const doc = result.assets[0];
      setPending({
        uri: doc.uri,
        name: doc.name,
        mime: doc.mimeType ?? 'application/octet-stream',
      });
    } catch (e) {
      Alert.alert('Document', (e as Error).message ?? 'Could not pick document');
    }
  };

  const openAttachMenu = () => {
    if (Platform.OS === 'web') {
      void pickImage(false);
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo library', 'Camera', 'Document'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) void pickImage(false);
          else if (idx === 2) void pickImage(true);
          else if (idx === 3) void pickDocument();
        }
      );
      return;
    }
    Alert.alert('Attach', undefined, [
      { text: 'Photo library', onPress: () => void pickImage(false) },
      { text: 'Camera', onPress: () => void pickImage(true) },
      { text: 'Document', onPress: () => void pickDocument() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const meUser: User | null = user ? (usersById[user.id] ?? (user as User)) : null;

  const runMessageAction = useCallback(
    async (action: 'copy' | 'reply' | 'forward' | 'edit' | 'delete', msg: Message) => {
      if (action === 'copy') {
        const copyText = [msg.content?.trim(), msg.attachment_url].filter(Boolean).join('\n');
        await Clipboard.setStringAsync(copyText || 'Message');
        return;
      }
      if (action === 'reply') {
        setEditingMessage(null);
        setReplyTo(msg);
        return;
      }
      if (action === 'forward') {
        setEditingMessage(null);
        setReplyTo(null);
        setForwardSearch('');
        setForwardingMessage(msg);
        return;
      }
      if (action === 'edit') {
        setReplyTo(null);
        setPending(null);
        setEditingMessage(msg);
        setDraft(msg.content ?? '');
        return;
      }
      Alert.alert('Delete message', 'This message will be permanently deleted.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMessageMutation.mutate(msg.id) },
      ]);
    },
    [deleteMessageMutation]
  );

  const openMessageActions = useCallback(
    (msg: Message) => {
      const isMine = msg.sender_id === user?.id;
      const iosOptions = ['Cancel', 'Copy', 'Reply', 'Forward', ...(isMine ? ['Edit', 'Delete'] : [])];
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: iosOptions,
            cancelButtonIndex: 0,
            destructiveButtonIndex: isMine ? iosOptions.length - 1 : undefined,
          },
          (idx) => {
            const picked = iosOptions[idx];
            if (picked === 'Copy') void runMessageAction('copy', msg);
            else if (picked === 'Reply') void runMessageAction('reply', msg);
            else if (picked === 'Forward') void runMessageAction('forward', msg);
            else if (picked === 'Edit') void runMessageAction('edit', msg);
            else if (picked === 'Delete') void runMessageAction('delete', msg);
          }
        );
        return;
      }
      Alert.alert('Message actions', 'Choose an action', [
        { text: 'Copy', onPress: () => void runMessageAction('copy', msg) },
        { text: 'Reply', onPress: () => void runMessageAction('reply', msg) },
        {
          text: 'More',
          onPress: () => {
            Alert.alert('More actions', undefined, [
              { text: 'Forward', onPress: () => void runMessageAction('forward', msg) },
              ...(isMine
                ? [
                    { text: 'Edit', onPress: () => void runMessageAction('edit', msg) },
                    {
                      text: 'Delete',
                      style: 'destructive' as const,
                      onPress: () => void runMessageAction('delete', msg),
                    },
                  ]
                : []),
              { text: 'Cancel', style: 'cancel' },
            ]);
          },
        },
      ]);
    },
    [runMessageAction, user?.id]
  );
  const forwardTargets = useMemo(() => {
    const meId = user?.id;
    const q = forwardSearch.trim().toLowerCase();
    return conversations
      .filter((c) => c.id !== conversationId)
      .map((c) => ({ conv: c, title: conversationTitle(c, meId, users) }))
      .filter((r) => (!q ? true : r.title.toLowerCase().includes(q)))
      .slice(0, 40);
  }, [conversations, conversationId, forwardSearch, user?.id, users]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={styles.loadingText}>Loading messages…</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        {headerInfo.isGroup ? (
          <View style={styles.headerAvatarWrap}>
            <View style={styles.groupAvatar}>
              <Ionicons name="people" size={22} color="#4a026f" />
            </View>
          </View>
        ) : (
          <View style={styles.headerAvatarWrap}>
            <UserAvatar user={headerInfo.avatarUser} size={40} />
          </View>
        )}
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerInfo.title}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {headerInfo.subtitle}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            const sender = usersById[item.sender_id];
            const showText = Boolean(item.content?.trim());
            const hasFile = Boolean(item.attachment_url);
            const fileUrl = item.attachment_url ? resolvePublicFileUrl(item.attachment_url) : '';
            const isImg = hasFile && fileUrl && isImageAttachmentUrl(fileUrl);
            const t = formatTime(item.created_at);

            const bubbleInner = (
              <>
                {isImg && fileUrl ? (
                  <Pressable
                    onPress={() => {
                      void Linking.openURL(fileUrl).catch(() =>
                        Alert.alert(
                          'Could not open',
                          'On a phone, set EXPO_PUBLIC_API_URL to your computer IP (not localhost).'
                        )
                      );
                    }}
                  >
                    <Image
                      source={{ uri: fileUrl }}
                      style={[styles.attachedImage, { width: maxImageWidth }]}
                      resizeMode="cover"
                    />
                  </Pressable>
                ) : null}
                {hasFile && !isImg && fileUrl ? (
                  <Pressable
                    style={styles.fileRow}
                    onPress={() => {
                      void Linking.openURL(fileUrl).catch(() =>
                        Alert.alert(
                          'Could not open file',
                          'Set EXPO_PUBLIC_API_URL to your machine IP when testing on a device.'
                        )
                      );
                    }}
                  >
                    <Ionicons
                      name="document-attach-outline"
                      size={22}
                      color={mine ? '#075E54' : '#54656f'}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[styles.fileName, mine && styles.fileNameMine]} numberOfLines={2}>
                      {fileLabelFromUrl(fileUrl)}
                    </Text>
                  </Pressable>
                ) : null}
                {showText ? (
                  <Text style={[styles.body, mine ? styles.bodySent : styles.bodyRecv]}>{item.content}</Text>
                ) : null}
              </>
            );

            if (mine) {
              return (
                <View style={[styles.msgRow, styles.msgRowMine]}>
                  <Text style={[styles.timeCol, styles.timeColMine]}>{t}</Text>
                  <Pressable style={[styles.bubble, styles.bubbleMine]} onLongPress={() => openMessageActions(item)}>
                    {bubbleInner}
                  </Pressable>
                  <View style={styles.avatarEnd}>
                    <UserAvatar user={meUser} size={40} />
                  </View>
                </View>
              );
            }

            return (
              <View style={[styles.msgRow, styles.msgRowTheirs]}>
                <View style={styles.avatarStart}>
                  <UserAvatar user={sender} size={40} />
                </View>
                <Pressable
                  style={[styles.bubble, styles.bubbleTheirs]}
                  onLongPress={() => openMessageActions(item)}
                >
                  {bubbleInner}
                </Pressable>
                <Text style={[styles.timeCol, styles.timeColTheirs]}>{t}</Text>
              </View>
            );
          }}
        />

        {replyTo ? (
          <View style={styles.contextBar}>
            <Text style={styles.contextLabel}>Replying to: {quoteForReply(replyTo)}</Text>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={10}>
              <Ionicons name="close" size={18} color="#54656f" />
            </Pressable>
          </View>
        ) : null}

        {editingMessage ? (
          <View style={styles.contextBar}>
            <Text style={styles.contextLabel}>Editing your message</Text>
            <Pressable
              onPress={() => {
                setEditingMessage(null);
                setDraft('');
              }}
              hitSlop={10}
            >
              <Ionicons name="close" size={18} color="#54656f" />
            </Pressable>
          </View>
        ) : null}

        {pending ? (
          <View style={styles.previewBar}>
            <View style={styles.previewThumbWrap}>
              {pending.mime.startsWith('image/') ? (
                <Image source={{ uri: pending.uri }} style={styles.previewThumb} resizeMode="cover" />
              ) : (
                <Ionicons name="document-text" size={32} color="#54656f" />
              )}
            </View>
            <Text style={styles.previewName} numberOfLines={1}>
              {pending.name}
            </Text>
            <Pressable onPress={() => setPending(null)} hitSlop={10}>
              <Ionicons name="close-circle" size={26} color="#54656f" />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <Pressable
            style={styles.attachBtn}
            onPress={openAttachMenu}
            hitSlop={8}
            accessibilityLabel="Attach file"
          >
            <Ionicons name="attach" size={26} color="#54656f" />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder={editingMessage ? 'Edit message' : 'Message'}
            placeholderTextColor="#8696a0"
            value={draft}
            onChangeText={setDraft}
            multiline
            blurOnSubmit={false}
          />
          <Pressable
            accessibilityLabel="Send message"
            style={({ pressed }) => [
              styles.sendBtn,
              !canSend && styles.sendDisabled,
              pressed && canSend && styles.sendPressed,
            ]}
            disabled={!canSend}
            onPressIn={sendNow}
            hitSlop={12}
          >
            {sendMutation.isPending || editMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name={editingMessage ? 'checkmark' : 'send'} size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={Boolean(forwardingMessage)} transparent animationType="fade" onRequestClose={() => setForwardingMessage(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Forward to conversation</Text>
            <TextInput
              style={styles.modalSearch}
              placeholder="Search conversation"
              placeholderTextColor="#7f8b93"
              value={forwardSearch}
              onChangeText={setForwardSearch}
            />
            <FlatList
              data={forwardTargets}
              keyExtractor={(r) => r.conv.id}
              style={styles.modalList}
              ListEmptyComponent={<Text style={styles.modalEmpty}>No conversations found.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => {
                    if (!forwardingMessage) return;
                    forwardMutation.mutate({
                      targetConversationId: item.conv.id,
                      message: forwardingMessage,
                    });
                  }}
                >
                  <Text style={styles.modalRowTitle}>{item.title}</Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.modalCancel} onPress={() => setForwardingMessage(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {forwardToastVisible ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>Message forwarded</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: WA_BG },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: WA_BG },
  loadingText: { marginTop: 8, color: '#54656f' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HEADER_BG,
    paddingBottom: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  backBtn: { padding: 8, marginRight: 4 },
  headerAvatarWrap: { marginRight: 10 },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8dff0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  listContent: { padding: 10, paddingBottom: 6 },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  msgRowTheirs: { justifyContent: 'flex-start', paddingRight: 8 },
  msgRowMine: { justifyContent: 'flex-end', paddingLeft: 8 },
  bubble: {
    maxWidth: '72%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
      },
      android: { elevation: 1 },
    }),
  },
  bubbleMine: {
    backgroundColor: BUBBLE_SENT,
    borderTopRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: BUBBLE_RECV,
    borderTopLeftRadius: 4,
  },
  timeCol: {
    width: 46,
    fontSize: 11,
    color: '#667781',
    textAlign: 'center',
    paddingBottom: 6,
  },
  timeColMine: { marginRight: 6 },
  timeColTheirs: { marginLeft: 6 },
  avatarStart: { marginRight: 8 },
  avatarEnd: { marginLeft: 8 },
  attachedImage: {
    height: 200,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#e5e5e5',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    maxWidth: maxImageWidth,
  },
  fileName: { flex: 1, fontSize: 14, color: '#075E54', fontWeight: '500' },
  fileNameMine: { color: '#075E54' },
  body: { fontSize: 15, lineHeight: 20 },
  bodySent: { color: '#111' },
  bodyRecv: { color: '#111' },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f6f6f6',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
  },
  previewThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewThumb: { width: 48, height: 48 },
  previewName: { flex: 1, marginHorizontal: 10, fontSize: 14, color: '#333' },
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eef2f5',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d7db',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contextLabel: { flex: 1, color: '#2f3b45', fontSize: 13, marginRight: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '75%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#20313d', marginBottom: 10 },
  modalSearch: {
    borderWidth: 1,
    borderColor: '#d2d9de',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#20313d',
    marginBottom: 10,
  },
  modalList: { flexGrow: 0 },
  modalRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e7eb',
  },
  modalRowTitle: { color: '#20313d', fontSize: 15, fontWeight: '600' },
  modalEmpty: { textAlign: 'center', color: '#667781', paddingVertical: 16 },
  modalCancel: {
    marginTop: 10,
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalCancelText: { color: '#4a026f', fontSize: 14, fontWeight: '700' },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 94,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: 'rgba(32, 49, 61, 0.94)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    backgroundColor: '#f0f0f0',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d7db',
  },
  attachBtn: {
    padding: 8,
    marginBottom: 2,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 16,
    color: '#111',
    marginRight: 6,
  },
  sendBtn: {
    backgroundColor: ACCENT,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendPressed: { opacity: 0.88 },
  sendDisabled: { opacity: 0.45 },
});
