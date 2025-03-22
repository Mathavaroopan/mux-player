// BradmaxPlayer.js
import React from 'react';
import { SafeAreaView, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import NavBar from './NavBar';

// Define the manifest URL based on the platform
const manifestUrl = Platform.OS === 'android'
  ? 'file:///android_asset/video/output.m3u8'
  : 'assets/video/output.m3u8';

// Build the HTML content with the Bradmax player configuration.
// The configuration is injected via data-bs-variables. Adjust title, duration, and splash image as needed.
const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Bradmax Player</title>
  </head>
  <body style="margin:0; padding:0; background-color:#000;">
    <div id="player" style="width:100%; height:100%;"></div>
    <!-- Configure Bradmax player to load your local output.m3u8 manifest -->
    <script 
      src="https://bradm.ax/build/202503/19/b9f452bea46b418bb35907a91d0e817dc0c03679/player.js" 
      type="text/javascript"
      data-bs-parent-id="player"
      data-bs-variables='{"dataProvider":{"source":[{"url":"${manifestUrl}"}],"title":"Local Output Video","duration":600,"splashImages":[{"url":"https://example.com/splash.jpg"}]}}'>
    </script>
  </body>
</html>
`;

export default function BradmaxPlayer() {
  return (
    <SafeAreaView style={styles.container}>
      <NavBar />
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        mixedContentMode={Platform.OS === 'android' ? 'always' : undefined}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
});
