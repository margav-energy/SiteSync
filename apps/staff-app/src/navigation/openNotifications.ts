import { CommonActions } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/**
 * Opens the Notifications screen — works from Home/Chat stacks (switches to Settings tab)
 * or from within Settings stack (pushes Notifications).
 */
export function openNotifications(navigation: NavigationProp<ParamListBase>): void {
  let p: NavigationProp<ParamListBase> | undefined = navigation;
  for (let i = 0; i < 10 && p; i++) {
    const names = p.getState()?.routeNames ?? [];
    if (names.includes('Notifications')) {
      (p as { navigate: (name: string) => void }).navigate('Notifications');
      return;
    }
    p = p.getParent() as NavigationProp<ParamListBase>;
  }

  navigation.dispatch(
    CommonActions.navigate({
      name: 'Settings',
      params: { screen: 'Notifications' },
    })
  );
}
