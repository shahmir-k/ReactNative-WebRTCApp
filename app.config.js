const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

module.exports = {
  expo: {
    name: "WebRTCApp",
    slug: "WebRTCApp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      SECRET1: process.env.SECRET1 || "Fallback secret",
      SIGNALING_SERVER_URL: process.env.SIGNALING_SERVER_URL || "ws://localhost:8080",
      STUN_SERVER_URL: process.env.STUN_SERVER_URL || "stun:stun.l.google.com:19302",
      TURN_SERVER_URL: process.env.TURN_SERVER_URL || "",
      TURN_SERVER_TCP_URL: process.env.TURN_SERVER_TCP_URL || "",
      TURN_SERVER_TLS_URL: process.env.TURN_SERVER_TLS_URL || "",
      TURN_USERNAME: process.env.TURN_USERNAME || "",
      TURN_CREDENTIAL: process.env.TURN_CREDENTIAL || "",
      ICE_CANDIDATE_POOL_SIZE: process.env.ICE_CANDIDATE_POOL_SIZE || "10",
      BUNDLE_POLICY: process.env.BUNDLE_POLICY || "balanced",
      RTCP_MUX_POLICY: process.env.RTCP_MUX_POLICY || "require",
      ICE_TRANSPORT_POLICY: process.env.ICE_TRANSPORT_POLICY || "all",
    },
    plugins: [
      "@config-plugins/react-native-webrtc",
      [
        "react-native-permissions",
        {
          iosPermissions: ["CAMERA", "MICROPHONE"]
        }
      ]
    ]
  }
}; 