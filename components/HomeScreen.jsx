// components/HomeScreen.jsx
import React from "react";
import { View, TouchableOpacity, StyleSheet, Text, ScrollView } from "react-native";

export default function HomeScreen({ navigation }) {
  // Use local video files instead of external HLS streams
  const videoFiles = [
    {
      id: 1,
      title: "Sample Video 1",
      url: "file:///android_asset/video/sample1.mp4",
      isLocal: true
    },
    {
      id: 2,
      title: "Sample Video 2",
      url: "file:///android_asset/video/sample2.mp4",
      isLocal: true
    },
    {
      id: 3,
      title: "Default Video",
      url: "file:///android_asset/video/output.m3u8",
      isLocal: true
    },
    {
      id: 4,
      title: "Big Buck Bunny",
      // This is a very reliable test video
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      isLocal: false
    }
  ];

  const navigateToPlayer = (video) => {
    navigation.navigate("MuxPlayer", { 
      streamUrl: video.url,
      streamTitle: video.title,
      isLocal: video.isLocal
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Video Player</Text>
      <Text style={styles.subtitle}>Select a video to play</Text>
      
      <ScrollView contentContainerStyle={styles.streamsContainer}>
        {videoFiles.map((video) => (
          <TouchableOpacity
            key={video.id}
            style={styles.streamCard}
            onPress={() => navigateToPlayer(video)}
          >
            <View style={styles.streamContent}>
              <View style={[styles.streamIcon, {backgroundColor: video.isLocal ? "#4CAF50" : "#3f51b5"}]}>
                <Text style={styles.streamIconText}>{video.isLocal ? "MP4" : "URL"}</Text>
              </View>
              <Text style={styles.streamTitle}>{video.title}</Text>
              <Text style={styles.sourceType}>{video.isLocal ? "Local File" : "Remote URL"}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#aaa",
    marginBottom: 30,
  },
  streamsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  streamCard: {
    width: "48%",
    backgroundColor: "#2c2c2c",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  streamContent: {
    padding: 16,
    alignItems: "center",
  },
  streamIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  streamIconText: {
    color: "#fff",
    fontWeight: "bold",
  },
  streamTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
    textAlign: "center",
    marginBottom: 6,
  },
  sourceType: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  }
});
