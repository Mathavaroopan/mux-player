// App.js
import 'react-native-gesture-handler';
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import your screens/components
import HomeScreen from './components/HomeScreen';
import BradmaxPlayer from './components/BradmaxPlayer';
import MuxPlayer from './components/MuxPlayer';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="BradmaxPlayer" component={BradmaxPlayer} />
        <Stack.Screen name="MuxPlayer" component={MuxPlayer} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
