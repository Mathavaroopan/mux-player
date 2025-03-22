// components/HomeScreen.jsx
import React from "react";
import { View, Button, StyleSheet, Text } from "react-native";

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Video Player App</Text>
      <View style={styles.buttonContainer}>
        <Button
          title="Go to Mux Player"
          onPress={() => navigation.navigate("MuxPlayer")}
          color="#4285F4"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  buttonContainer: {
    marginVertical: 10,
    width: "80%",
  },
});
