// components/BradmaxPlayer.jsx

import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, SafeAreaView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import NavBar from './NavBar';

export default function BradmaxPlayer() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugMessages, setDebugMessages] = useState([]);
  const webViewRef = useRef(null);

  // Using a more reliable sample HLS stream
  const videoUrl = 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8';
  
  // Backup streams if the primary one fails
  const backupStreams = [
    'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    'https://cdn.jwplayer.com/manifests/pZxWPRg4.m3u8'
  ];

  // HTML content for WebView using HLS.js.
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>HLS Player</title>
        <script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.10/dist/hls.min.js"></script>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: #000;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          #video {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          #error {
            color: red;
            font-family: Arial, sans-serif;
            text-align: center;
            display: none;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 5px;
            max-width: 80%;
          }
          #debug {
            display: none;
          }
          #controls {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.5);
            padding: 8px;
            border-radius: 5px;
            display: none;
          }
          #retry-button {
            background: #4285f4;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <video id="video" controls playsinline></video>
        <div id="error"></div>
        <div id="debug"></div>
        <div id="controls">
          <button id="retry-button">Try Another Source</button>
        </div>
        <script>
          // Function to send messages to React Native
          function postToRN(type, message) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type, message }));
          }
          
          // Override console.log so that logs are sent to React Native
          const originalConsoleLog = console.log;
          console.log = function() {
            const args = Array.from(arguments);
            originalConsoleLog.apply(console, args);
            if (args.length > 0) {
              postToRN('log', args.join(' '));
            }
          };

          // Get DOM elements
          const video = document.getElementById('video');
          const errorDisplay = document.getElementById('error');
          const controls = document.getElementById('controls');
          const retryButton = document.getElementById('retry-button');
          window.video = video;
          window.hls = null;

          // Store available sources
          const sources = [
            '${videoUrl}',
            '${backupStreams[0]}',
            '${backupStreams[1]}',
            '${backupStreams[2]}'
          ];
          let currentSourceIndex = 0;

          function showError(msg) {
            errorDisplay.textContent = msg;
            errorDisplay.style.display = 'block';
            controls.style.display = 'block';
            postToRN('error', msg);
          }
          
          function clearError() {
            errorDisplay.style.display = 'none';
            errorDisplay.textContent = '';
            controls.style.display = 'none';
          }

          let bufferCheckInterval = null;
          let lastTime = 0;
          let stuckCounter = 0;
          let recoveryAttempt = 0;
          const MAX_RECOVERY_ATTEMPTS = 5;

          function startBufferMonitor() {
            if (bufferCheckInterval) clearInterval(bufferCheckInterval);
            lastTime = video.currentTime;
            stuckCounter = 0;
            bufferCheckInterval = setInterval(() => {
              if (!video.paused && !video.seeking && video.readyState > 0) {
                if (Math.abs(video.currentTime - lastTime) < 0.01) {
                  stuckCounter++;
                  if (stuckCounter >= 4) {
                    console.log('Playback appears stuck, attempting recovery');
                    recoverPlayback();
                    stuckCounter = 0;
                  }
                } else {
                  stuckCounter = 0;
                }
                lastTime = video.currentTime;
              }
            }, 500);
          }

          function recoverPlayback() {
            if (recoveryAttempt >= MAX_RECOVERY_ATTEMPTS) {
              console.log('Maximum recovery attempts reached');
              showError('Playback issues detected. Try another source.');
              return;
            }
            
            recoveryAttempt++;
            console.log('Recovery attempt #' + recoveryAttempt);
            
            switch (recoveryAttempt) {
              case 1:
                if (window.hls) { video.play().catch(err => console.log('Play error:', err)); }
                break;
              case 2:
                if (window.hls) { window.hls.startLoad(); setTimeout(() => video.play(), 100); }
                break;
              case 3:
                if (window.hls) { video.currentTime = Math.max(0, video.currentTime - 2); window.hls.startLoad(); }
                break;
              case 4:
                if (window.hls) { window.hls.stopLoad(); window.hls.startLoad(); setTimeout(() => video.play(), 200); }
                break;
              case 5:
                reinitializePlayer();
                break;
            }
          }

          function reinitializePlayer() {
            console.log('Reinitializing player');
            const currentTime = video.currentTime;
            if (window.hls) {
              window.hls.destroy();
              window.hls = null;
            }
            video.removeAttribute('src');
            video.load();
            setTimeout(() => {
              initPlayer();
              video.addEventListener('loadedmetadata', function onceLoaded() {
                video.removeEventListener('loadedmetadata', onceLoaded);
                if (currentTime > 0) { video.currentTime = currentTime; }
                video.play();
              });
            }, 100);
          }

          function tryNextSource() {
            currentSourceIndex = (currentSourceIndex + 1) % sources.length;
            console.log('Trying next source:', sources[currentSourceIndex]);
            clearError();
            initPlayerWithPath(sources[currentSourceIndex]);
          }

          // Initialize with the first source
          function initPlayer() {
            recoveryAttempt = 0;
            clearError();
            
            // Set a longer timeout for manifest loading
            setTimeout(() => {
              if (video.readyState === 0) {
                console.log('Timeout: Video manifest not loaded');
                showError('Video failed to load. Try another source.');
              }
            }, 15000);
            
            initPlayerWithPath(sources[currentSourceIndex]);
          }

          function initPlayerWithPath(videoSrc) {
            console.log('Initializing player with URL:', videoSrc);
            if (window.hls) {
              window.hls.destroy();
              window.hls = null;
            }
            
            if (Hls.isSupported()) {
              const hls = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90,
                maxBufferLength: 30,
                maxBufferSize: 60 * 1000 * 1000,
                maxMaxBufferLength: 60,
                maxLoadingDelay: 4,
                manifestLoadingTimeOut: 20000,
                manifestLoadingMaxRetry: 6,
                levelLoadingTimeOut: 20000,
                levelLoadingMaxRetry: 6,
                fragLoadingTimeOut: 30000,
                fragLoadingMaxRetry: 6,
                startFragPrefetch: true,
                testBandwidth: true,
                progressive: true,
                abrEwmaDefaultEstimate: 5000000,
                abrBandWidthFactor: 0.95,
                abrBandWidthUpFactor: 0.7,
                startLevel: -1, // Auto level selection
                capLevelToPlayerSize: true
              });
              
              window.hls = hls;
              
              hls.on(Hls.Events.MEDIA_ATTACHED, function() {
                console.log('HLS: Media attached, loading source:', videoSrc);
                hls.loadSource(videoSrc);
              });
              
              hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
                console.log('HLS: Manifest parsed, ' + data.levels.length + ' quality levels found');
                postToRN('ready', 'Video ready');
                video.play().catch(err => {
                  console.log('Auto-play prevented:', err.message);
                  postToRN('ready', 'Video loaded, tap to play');
                });
                startBufferMonitor();
              });
              
              hls.on(Hls.Events.ERROR, function(event, data) {
                console.log('HLS error:', data.type, data.details);
                if (data.fatal) {
                  switch(data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      console.log('Fatal network error');
                      if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || 
                          data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                        console.log('Manifest load error, trying next source');
                        showError('Stream unavailable. Try another source.');
                      } else {
                        hls.startLoad();
                      }
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      console.log('Fatal media error');
                      hls.recoverMediaError();
                      break;
                    default:
                      console.log('Fatal error, cannot recover');
                      showError('Video playback error');
                      hls.destroy();
                      break;
                  }
                }
              });
              
              hls.on(Hls.Events.FRAG_LOADING, function(event, data) {
                console.log('Loading fragment:', data.frag.sn);
              });
              
              hls.on(Hls.Events.FRAG_LOADED, function(event, data) {
                console.log('Loaded fragment:', data.frag.sn);
                recoveryAttempt = 0;
              });
              
              hls.on(Hls.Events.FRAG_LOAD_ERROR, function(event, data) {
                console.log('Fragment load error:', data.frag.sn);
                if (!data.fatal) {
                  console.log('Non-fatal fragment load error, will retry');
                }
              });
              
              hls.on(Hls.Events.BUFFER_APPENDED, function(event, data) {
                console.log('Buffer appended:', data.parent, 'type:', data.type);
              });
              
              hls.attachMedia(video);
              
              video.addEventListener('error', function(e) {
                const err = e.target.error;
                console.log('Video error:', err ? err.code : 'unknown');
                showError(err && err.code === err.MEDIA_ERR_SRC_NOT_SUPPORTED
                          ? 'This video format is not supported'
                          : 'Video playback error: ' + (err ? err.code : 'unknown'));
              });
              
              video.addEventListener('waiting', function() { console.log('Video waiting for data'); });
              video.addEventListener('stalled', function() { console.log('Video playback stalled'); });
              video.addEventListener('play', () => postToRN('state', 'playing'));
              video.addEventListener('pause', () => postToRN('state', 'paused'));
              video.addEventListener('seeking', () => {
                console.log('Video seeking to', video.currentTime);
                postToRN('state', 'seeking');
              });
              video.addEventListener('seeked', () => {
                console.log('Video seeked to', video.currentTime);
                postToRN('state', 'seeked');
              });
              video.addEventListener('ended', () => postToRN('state', 'ended'));
              video.addEventListener('progress', () => {
                if (video.buffered.length > 0) {
                  const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                  const duration = video.duration;
                  const bufferedPercent = ((bufferedEnd / duration) * 100).toFixed(2);
                  console.log(\`Buffered: \${bufferedPercent}% (\${bufferedEnd.toFixed(2)}/\${duration.toFixed(2)})\`);
                }
              });
            }
            else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              console.log('Using native HLS support');
              video.src = videoSrc;
              video.addEventListener('loadedmetadata', function() {
                console.log('Video metadata loaded');
                postToRN('ready', 'Video ready');
                video.play().catch(err => console.log('Auto-play prevented:', err.message));
                startBufferMonitor();
              });
              video.addEventListener('error', function(e) {
                const err = e.target.error;
                console.log('Video error:', err ? err.code : 'unknown');
                showError('Video playback error');
              });
            }
            else {
              console.log('HLS not supported');
              showError('HLS video playback is not supported in this browser');
            }
          }

          // Handle visibility changes
          document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'visible') {
              console.log('Tab became visible, checking playback');
              if (!video.paused && video.readyState < 3) {
                console.log('Playback may be stalled, attempting to recover');
                if (window.hls) { window.hls.startLoad(); }
                video.play().catch(err => console.log('Resume error:', err));
              }
            }
          });

          // Set up retry button
          retryButton.addEventListener('click', function() {
            tryNextSource();
          });

          // Initialize the player immediately
          initPlayer();
          window.reinitPlayer = reinitializePlayer;
          window.recoverPlayback = recoverPlayback;
          window.tryNextSource = tryNextSource;
        </script>
      </body>
    </html>
  `;

  // Handle messages from the WebView
  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Player event:', data);
      if (data.type === 'log') {
        setDebugMessages(prev => {
          const newMessages = [...prev, data.message];
          return newMessages.slice(-10);
        });
      }
      switch (data.type) {
        case 'ready':
          setLoading(false);
          setError(null);
          break;
        case 'error':
          setError(data.message);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Error parsing WebView message:', err);
    }
  };

  // Function to trigger source switching from React Native
  const switchSource = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('window.tryNextSource(); true;');
    }
  };

  // Since we're using an external HTTPS URL, no special baseUrl is needed
  const sourceProps = { html: htmlContent };

  return (
    <SafeAreaView style={styles.safeArea}>
      <NavBar />
      <View style={styles.container}>
        <Text style={styles.heading}>HLS Video Player</Text>
        <View style={styles.playerContainer}>
          <WebView
            ref={webViewRef}
            style={styles.webview}
            source={sourceProps}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            allowingReadAccessToURL={'*'}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onMessage={onMessage}
            onError={(e) => {
              console.error('WebView error:', e.nativeEvent);
              setError('WebView error: ' + (e.nativeEvent.description || 'Unknown error'));
            }}
            onHttpError={(e) => {
              console.error('WebView HTTP error:', e.nativeEvent);
              if (e.nativeEvent.statusCode >= 500) {
                setError('Server error: ' + e.nativeEvent.statusCode);
              }
            }}
          />
          {loading && (
            <View style={styles.overlay}>
              <Text style={styles.loadingText}>Loading player...</Text>
            </View>
          )}
          {error && (
            <View style={styles.overlay}>
              <Text style={styles.errorText}>{error}</Text>
              <View style={styles.buttonContainer}>
                <Text 
                  style={styles.button}
                  onPress={switchSource}>
                  Try Another Source
                </Text>
              </View>
            </View>
          )}
        </View>
      
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  heading: {
    fontSize: 36,
    marginBottom: 20,
  },
  playerContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  webview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
    marginBottom: 20,
  },
  buttonContainer: {
    marginTop: 10,
  },
  button: {
    backgroundColor: '#4285f4',
    color: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    overflow: 'hidden',
    textAlign: 'center',
    fontSize: 16,
  },
  debugContainer: {
    width: '90%',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 5,
    maxHeight: 150,
    marginTop: 20,
  },
  debugTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugText: {
    color: '#ffcc00',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});