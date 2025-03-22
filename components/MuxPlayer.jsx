// components/VideoPlayer.jsx

import React, { useRef, useState, useEffect } from "react";
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  Text, 
  ActivityIndicator, 
  TouchableOpacity, 
  StatusBar,
  SafeAreaView,
  BackHandler,
  Modal,
  TextInput,
  Alert
} from "react-native";
import Video from "react-native-video";
import muxReactNativeVideo from "@mux/mux-data-react-native-video";
import app from "../package.json";

// Only use Mux analytics for remote videos
const MuxVideo = muxReactNativeVideo(Video);

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MuxPlayer({ route, navigation }) {
  // Get video info from route params
  const { streamUrl, streamTitle, isLocal = true } = route.params || {};
  const videoRef = useRef(null);
  
  // Player state
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  
  // Segment handling
  const [segments, setSegments] = useState([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [lastProcessedTime, setLastProcessedTime] = useState(0);
  const [completedSegments, setCompletedSegments] = useState([]);

  // Handle back button
  useEffect(() => {
    const backAction = () => {
      navigation.goBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [navigation]);

  // Initialize segments based on HLS file (simulated because we can't read the m3u8 file directly)
  useEffect(() => {
    // For demonstration, we'll create segment boundaries based on video duration
    // In a real implementation, you would parse the .m3u8 file to get actual segments
    const initializeSegments = () => {
      if (duration > 0) {
        // Create segments based on approximately 10 second intervals
        const segmentCount = Math.ceil(duration / 10);
        const segmentList = [];
        
        for (let i = 0; i < segmentCount; i++) {
          const start = i * 10;
          const end = Math.min((i + 1) * 10, duration);
          
          segmentList.push({
            index: i,
            start: start,
            end: end,
            name: `Segment ${i + 1}`
          });
        }
        
        setSegments(segmentList);
        console.log("Initialized segments:", segmentList);
      }
    };
    
    initializeSegments();
  }, [duration]);

  // Video load event handler
  const handleLoad = (data) => {
    console.log("Video loaded successfully", data);
    setLoading(false);
    setDuration(data.duration || 0);
    
    // Calculate aspect ratio if available
    if (data.naturalSize) {
      const { width, height, orientation } = data.naturalSize;
      const actualWidth = orientation === 'landscape' ? width : height;
      const actualHeight = orientation === 'landscape' ? height : width;
      const aspect = actualHeight > 0 ? actualWidth / actualHeight : 16/9;
      setVideoAspect(aspect);
    }
  };

  // Error handling
  const handleError = (err) => {
    console.error("Video playback error:", err);
    if (err.error && err.error.errorString) {
      if (err.error.errorString.includes("IndexOutOfBounds")) {
        setError("Format error: This m3u8 stream appears to be corrupted or incompatible.");
      } else {
        setError(`Playback error: ${err.error.errorString}`);
      }
    } else {
      setError("Unknown playback error occurred");
    }
    setLoading(false);
  };

  // Video progress update
  const handleProgress = (progress) => {
    if (progress && typeof progress.currentTime === 'number') {
      setCurrentTime(progress.currentTime);
      
      // No segment handling if modal is already showing
      if (showSegmentModal) {
        return;
      }
      
      // Check if we're crossing a segment boundary
      if (segments.length > 0) {
        // Find the current segment
        const currentSegment = segments.find(segment => 
          progress.currentTime >= segment.start && progress.currentTime < segment.end
        );
        
        if (currentSegment) {
          // If we've moved to a new segment, check if it's forward movement
          if (currentSegment.index !== currentSegmentIndex) {
            console.log(`Transitioning from segment ${currentSegmentIndex} to ${currentSegment.index}`);
            
            // We're crossing a segment boundary
            if (currentSegment.index > currentSegmentIndex) {
              // Only show form lock before the 2nd segment (index 1)
              if (currentSegment.index === 1 && !completedSegments.includes(0)) {
                // Moving to 2nd segment - enforce email collection
                setIsPaused(true);
                setShowSegmentModal(true);
                // Save where we are for resuming
                setLastProcessedTime(progress.currentTime);
                setCurrentSegmentIndex(currentSegment.index);
                
                // Force seeking back to the end of previous segment if needed
                if (videoRef.current) {
                  const previousSegmentEnd = segments[currentSegmentIndex].end;
                  videoRef.current.seek(previousSegmentEnd - 0.1);
                }
              } else {
                // For all other segments, just update state and continue
                setCurrentSegmentIndex(currentSegment.index);
                setLastProcessedTime(progress.currentTime);
              }
            } else {
              // Moving backwards, just update the segment index
              setCurrentSegmentIndex(currentSegment.index);
              setLastProcessedTime(progress.currentTime);
            }
          }
        }
      }
    }
  };

  // Handle seek events
  const handleSeek = (data) => {
    console.log("Seek event triggered", data);
    const seekTime = data.seekTime || 0;
    
    // Find which segment this time falls into
    if (segments.length > 0 && !showSegmentModal) {
      const targetSegment = segments.find(segment => 
        seekTime >= segment.start && seekTime < segment.end
      );
      
      // If seeking forward beyond first segment, handle specially
      if (targetSegment && targetSegment.index > currentSegmentIndex) {
        console.log(`Attempting to seek to segment ${targetSegment.index} from ${currentSegmentIndex}`);
        
        // Only block seeking to segment 1 (2nd segment) if it hasn't been unlocked
        if (targetSegment.index === 1 && !completedSegments.includes(0)) {
          console.log("Blocked seeking forward to locked 2nd segment");
          
          // Seeking to the locked 2nd segment, go back to first segment
          if (videoRef.current) {
            const currentSegment = segments[currentSegmentIndex];
            const safeSeekTime = (currentSegment.start + currentSegment.end) / 2;
            
            // We need to defer this seek slightly to avoid conflict
            setTimeout(() => {
              videoRef.current.seek(safeSeekTime);
              setLastProcessedTime(safeSeekTime);
            }, 50);
          }
        } else {
          // This seek is allowed (not to the locked 2nd segment)
          setCurrentSegmentIndex(targetSegment.index);
          setLastProcessedTime(seekTime);
        }
      } else if (targetSegment) {
        // Seeking backward or within current segment is always allowed
        setCurrentSegmentIndex(targetSegment.index);
        setLastProcessedTime(seekTime);
      }
    }
  };

  // Buffer state handler
  const handleBuffer = (bufferInfo) => {
    if (bufferInfo && typeof bufferInfo.isBuffering === 'boolean') {
      setIsBuffering(bufferInfo.isBuffering);
    }
  };

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle email form submission
  const handleEmailSubmit = () => {
    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    // Email is valid, continue playback
    console.log(`Email submitted: ${email} at segment ${currentSegmentIndex}`);
    
    // Mark previous segment as completed
    setCompletedSegments(prev => [...prev, currentSegmentIndex - 1]);
    
    setEmailError('');
    setEmail(''); // Reset email field for next time
    setShowSegmentModal(false);
    setIsPaused(false);
    
    // You could save the email to a database or API here
  };

  // Handle cancel button in email form
  const handleCancel = () => {
    // Since we only lock at segment 1, and cancel should skip to segment 2
    if (segments.length > 2) {
      console.log(`Cancelling form, skipping to segment 2`);
      
      // Reset form state
      setEmail('');
      setEmailError('');
      setShowSegmentModal(false);
      
      // Skip to segment 2 (3rd segment)
      setCurrentSegmentIndex(2);
      
      // Seek to the start of segment 2
      if (videoRef.current && segments[2]) {
        const skipToTime = segments[2].start;
        videoRef.current.seek(skipToTime);
        setLastProcessedTime(skipToTime);
      }
      
      // Resume playback
      setIsPaused(false);
    } else {
      // Not enough segments, just close modal and resume
      setEmail('');
      setEmailError('');
      setShowSegmentModal(false);
      setIsPaused(false);
    }
  };

  // Format time display
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Return to home screen
  const goBack = () => {
    navigation.goBack();
  };

  // Calculate player size
  const playerHeight = Math.min(
    screenWidth / videoAspect,
    screenHeight * 0.6
  );

  // Choose the appropriate Video component based on whether the source is local or remote
  const VideoComponent = isLocal ? Video : MuxVideo;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{streamTitle || "Video Player"}</Text>
        <View style={styles.spacer} />
      </View>
      
      <View style={[styles.playerContainer, { height: playerHeight }]}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={goBack}>
              <Text style={styles.buttonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <VideoComponent
              ref={videoRef}
              source={{ uri: streamUrl }}
              style={styles.video}
              resizeMode="contain"
              controls={true}
              paused={isPaused}
              onError={handleError}
              onLoad={handleLoad}
              onProgress={handleProgress}
              onSeek={handleSeek}
              onBuffer={handleBuffer}
              playInBackground={false}
              repeat={false}
              ignoreSilentSwitch="ignore"
              useTextureView={true}
              // For mux analytics (only for non-local videos)
              {...(!isLocal && {
                muxOptions: {
                  application_name: app.name,
                  application_version: app.version,
                  data: {
                    env_key: 'YOUR_ENVIRONMENT_KEY',
                    player_name: 'React Native Player',
                    video_id: streamTitle || 'Unknown',
                    video_title: streamTitle || 'Unknown',
                  },
                }
              })}
            />
            
            {(loading || isBuffering) && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>
                  {isBuffering ? "Buffering..." : "Loading video..."}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Email Modal when segment changes */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSegmentModal}
        onRequestClose={() => {
          // Don't allow dismissing the modal without explicit action
          console.log("Modal close attempted");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Access Second Segment</Text>
            <Text style={styles.modalText}>
              To watch the second segment of this video, please enter your email address.
              Or press Cancel to skip to the third segment.
            </Text>
            
            <TextInput
              style={styles.emailInput}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            {emailError ? (
              <Text style={styles.errorMessage}>{emailError}</Text>
            ) : null}
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Skip Segment</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleEmailSubmit}
              >
                <Text style={styles.submitButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.controlsContainer}>
        <Text style={styles.titleText}>{streamTitle}</Text>
        <Text style={styles.timeText}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
        
        <View style={styles.sourceInfo}>
          <Text style={styles.sourceText}>
            {isLocal ? "Local M3U8 Stream" : "Remote Stream"}
          </Text>
          <Text style={styles.segmentText}>
            {segments.length > 0 ? `Segment ${currentSegmentIndex + 1} of ${segments.length}` : ""}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1e1e1e",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#2c2c2c",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    color: "#fff",
    fontWeight: "bold",
  },
  spacer: {
    width: 40,
  },
  playerContainer: {
    width: screenWidth,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    color: "#f44336",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
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
    marginTop: 16,
  },
  controlsContainer: {
    padding: 16,
  },
  titleText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  timeText: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 8,
  },
  sourceInfo: {
    marginTop: 8,
  },
  sourceText: {
    color: "#4CAF50",
    fontSize: 14,
  },
  segmentText: {
    color: "#4CAF50",
    fontSize: 14,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 24,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
    textAlign: "center",
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    color: "#666",
  },
  emailInput: {
    width: "100%",
    height: 48,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#333",
    marginBottom: 12,
  },
  errorMessage: {
    color: "#f44336",
    fontSize: 14,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 16,
  },
  cancelButton: {
    backgroundColor: "#f44336",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    minWidth: "45%",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  submitButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    minWidth: "45%",
    alignItems: "center",
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});