import React, { useMemo } from 'react';
import { StatusBar, Text, useColorScheme } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedScreen } from './src/screens/FeedScreen';
import { BrainScreen } from './src/screens/BrainScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

enableScreens();

const Tab = createBottomTabNavigator();

const App = () => {
  const colorScheme = useColorScheme();

  const navigationTheme = useMemo(
    () => (colorScheme === 'dark' ? DarkTheme : DefaultTheme),
    [colorScheme],
  );

  const statusBarStyle = colorScheme === 'dark' ? 'light-content' : 'dark-content';

  const renderTabIcon = (symbol: string) => ({ color }: { color: string }) => (
    <Text style={{ fontSize: 18, color }}>{symbol}</Text>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar barStyle={statusBarStyle} />
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: { paddingBottom: 6, height: 60 },
              tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
              tabBarActiveTintColor: '#2563eb',
              tabBarInactiveTintColor: '#6b7280',
            }}
          >
            <Tab.Screen
              name="Feed"
              component={FeedScreen}
              options={{
                tabBarLabel: 'Feed',
                tabBarIcon: renderTabIcon('🧠'),
              }}
            />
            <Tab.Screen
              name="Brain"
              component={BrainScreen}
              options={{
                tabBarLabel: 'Brain',
                tabBarIcon: renderTabIcon('📊'),
              }}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                tabBarLabel: 'Settings',
                tabBarIcon: renderTabIcon('⚙️'),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
