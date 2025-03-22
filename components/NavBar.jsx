// components/NavBar.jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NavBar() {
  return (
    <View style={styles.navBar}>
      <Text style={styles.title}>My App</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    width: '100%',
    height: 60,
    backgroundColor: '#ff5722',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 20,
  },
});
