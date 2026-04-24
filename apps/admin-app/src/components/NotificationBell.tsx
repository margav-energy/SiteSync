import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { notificationsService } from '@staff4dshire/shared';
import { openNotifications } from '../navigation/openNotifications';

export function NotificationBell() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const { data: items = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsService.getAll(),
    staleTime: 20_000,
  });

  const unread = items.filter((n) => !n.read).length;

  return (
    <Pressable
      onPress={() => openNotifications(navigation)}
      style={styles.hit}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="Notifications"
      accessibilityHint="Opens notification list"
    >
      <View style={styles.wrap}>
        <Ionicons name="notifications-outline" size={24} color="#fff" />
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { marginRight: 4, justifyContent: 'center' },
  wrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
