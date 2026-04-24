import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ChatListScreen } from '../screens/chat/ChatListScreen';
import { ChatConversationScreen } from '../screens/chat/ChatConversationScreen';
import { NewConversationScreen } from '../screens/chat/NewConversationScreen';
import { NotificationBell } from '../components/NotificationBell';

export type ChatStackParamList = {
  ChatList: undefined;
  NewConversation: undefined;
  ChatConversation: { conversationId: string; title?: string };
};

const Stack = createNativeStackNavigator<ChatStackParamList>();

export function ChatStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#4a026f' },
        headerTintColor: '#fff',
        headerBackTitle: 'Back',
        headerRight: () => <NotificationBell />,
      }}
    >
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={({ navigation }) => ({
          title: 'Messages',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <NotificationBell />
              <TouchableOpacity
                onPress={() => navigation.navigate('NewConversation')}
                style={{ paddingHorizontal: 10 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="create-outline" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="NewConversation"
        component={NewConversationScreen}
        options={{ title: 'New message', headerRight: () => null }}
      />
      <Stack.Screen
        name="ChatConversation"
        component={ChatConversationScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
