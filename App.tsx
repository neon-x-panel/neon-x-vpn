import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { VpnProvider } from './src/context/VpnContext';
import { HomeScreen } from './src/screens/HomeScreen';

export default function App() {
  return (
    <VpnProvider>
      <StatusBar style="light" />
      <HomeScreen />
    </VpnProvider>
  );
}
