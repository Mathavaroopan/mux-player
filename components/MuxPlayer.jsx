// components/VideoPlayer.jsx

import React, { useRef, useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Text, ActivityIndicator, TouchableOpacity, Modal } from "react-native";
import Video from "react-native-video";
import muxReactNativeVideo from "@mux/mux-data-react-native-video";
import app from "../package.json"; // Adjust path if necessary

// Wrap the react-native-video component with Mux Data SDK functionality
const MuxVideo = muxReactNativeVideo(Video);

// Get screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MuxPlayer() {
    const originalUrl = 'file:///android_asset/video/output.m3u8';
    const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoAspect, setVideoAspect] = useState(16 / 9); // Default aspect ratio
  const [videoHeight, setVideoHeight] = useState(0);
  const [videoWidth, setVideoWidth] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSegmentAlert, setShowSegmentAlert] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [segments, setSegments] = useState([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

  // Parse m3u8 to get segment information
  useEffect(() => {
    const fetchM3u8 = async () => {
      try {
        // For local files, we'll define pre-defined segments based on the m3u8
        // Define segments based on the duration in the m3u8 file
        const segmentDurations = [12.0, 15.0, 32.16, 30.16, 15.16]; // From output.m3u8
        let cumulativeTime = 0;
        const parsedSegments = segmentDurations.map((duration, index) => {
          const segment = {
            index,
            start: cumulativeTime,
            end: cumulativeTime + duration,
            duration: duration,
            name: `Segment ${index + 1}`
          };
          cumulativeTime += duration;
          return segment;
        });
        
        setSegments(parsedSegments);
        console.log("Parsed segments:", parsedSegments);
      } catch (error) {
        console.error("Error parsing m3u8:", error);
      }
    };
    
    fetchM3u8();
  }, [originalUrl]);

  const handleError = (err) => {
    console.error("Video playback error:", err);
    setError(`Error playing video: ${err.error?.errorString || 'Unknown error'}`);
    setLoading(false);
  };

  const handleLoad = (data) => {
    console.log("Video loaded successfully", data);
    setLoading(false);
    setDuration(data.duration);
    
    // Calculate aspect ratio if we have video dimensions
    if (data.naturalSize) {
      const { width, height, orientation } = data.naturalSize;
      
      // Check if orientation is landscape or portrait
      const actualWidth = orientation === 'landscape' ? width : height;
      const actualHeight = orientation === 'landscape' ? height : width;
      
      // Set aspect ratio
      const aspect = actualWidth / actualHeight;
      setVideoAspect(aspect);
      
      // Store dimensions
      setVideoWidth(actualWidth);
      setVideoHeight(actualHeight);
      
      console.log(`Video dimensions: ${actualWidth}x${actualHeight}, Aspect ratio: ${aspect}`);
    }
  };

  const handleProgress = (progress) => {
    setCurrentTime(progress.currentTime);
    
    // Check if we're approaching a segment boundary
    const currentSegment = segments[currentSegmentIndex];
    if (currentSegment && progress.currentTime >= currentSegment.end - 0.5) {
      // We're near the end of this segment
      if (currentSegmentIndex < segments.length - 1) {
        // There's another segment coming up
        if (!showSegmentAlert && !isPaused) {
          setIsPaused(true);
          setShowSegmentAlert(true);
          videoRef.current.seek(currentSegment.end);
        }
      }
    }
  };

  const handleProceed = () => {
    setShowSegmentAlert(false);
    const nextSegmentIndex = currentSegmentIndex + 1;
    if (nextSegmentIndex < segments.length) {
      setCurrentSegmentIndex(nextSegmentIndex);
      setIsPaused(false);
      // Seek to the start of the next segment if needed
      videoRef.current.seek(segments[nextSegmentIndex].start);
    }
  };

  // Calculate container dimensions based on aspect ratio
  const containerWidth = screenWidth - 40; // 20px padding on each side
  const containerHeight = Math.min(
    containerWidth / videoAspect,  // Height based on width and aspect ratio
    screenHeight * 0.6             // Max 60% of screen height
  );

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          <MuxVideo
            ref={videoRef}
            source={{ uri: originalUrl }}
            style={styles.video}
            controls={true}
            resizeMode="contain"
            paused={isPaused}
            onError={handleError}
            onLoad={handleLoad}
            onProgress={handleProgress}
            // Add Mux Data monitoring options
            muxOptions={{
              application_name: app.name,          // Required: Your application name
              application_version: app.version,    // Recommended: Your application version
              data: {
                env_key: 'YOUR_ENVIRONMENT_KEY',   // Required: Replace with your actual environment key
                player_software_version: '5.0.2',    // Recommended: Version of react-native-video
                player_name: 'React Native Player',  // Player name (refer to Mux metadata docs for more fields)
                video_id: 'My Video Id',
                video_title: 'My awesome video',
              },
            }}
          />
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText}>Loading video...</Text>
            </View>
          )}
          
          {/* Segment Transition Alert Modal */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={showSegmentAlert}
            onRequestClose={() => setShowSegmentAlert(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Segment Completed</Text>
                {currentSegmentIndex < segments.length - 1 && (
                  <Text style={styles.modalText}>
                    You have completed {segments[currentSegmentIndex]?.name}.
                    Would you like to proceed to {segments[currentSegmentIndex + 1]?.name}?
                  </Text>
                )}
                <TouchableOpacity 
                  style={styles.proceedButton}
                  onPress={handleProceed}
                >
                  <Text style={styles.proceedButtonText}>Proceed</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: screenWidth - 40, // Full width minus padding
    backgroundColor: "#000",
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  errorText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    padding: 20,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  loadingText: {
    color: "white",
    fontSize: 18,
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  proceedButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  proceedButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});