import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VpnProvider } from './src/context/VpnContext';
import { HomeScreen } from './src/screens/HomeScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <VpnProvider>
        <StatusBar style="light" />
        <HomeScreen />
      </VpnProvider>
    </SafeAreaProvider>
  );
}
