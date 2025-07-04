# React Native WebRTC App - Build Instructions

_Shahmir Khan - June 23, 2025_
updated june 27, 2025

We are going to build a React-Native WebRTC app from scratch

## Prerequisites

install expo-cli
(don't do this)

```bash
npm install expo-cli
```

## 1. Create the Expo Project

First lets create the expo project:

```bash
npx create-expo-app WebRTCApp --template blank
```

(change it to latest expo actually)

## 2. Install Core Dependencies

we must install using Expo:

```bash
npx expo install react-dom react-native-web
```

Then the Babel plugin for optimization:

```bash
npx expo install babel-plugin-react-native-web
```

Install @expo/metro-runtime@~5.0.4 by running:

```bash
npx expo install @expo/metro-runtime
```

Let's first install react-native-webrtc:

```bash
npx expo install react-native-webrtc
```

Now lets install the web-shim:

```bash
npx expo install react-native-webrtc-web-shim
```

Now lets setup the Expo config plugin:

```bash
npx expo install react-native-webrtc @config-plugins/react-native-webrtc
```

After installing this npm package, add the config plugin to the plugins array of your app.json or app.config.js:

```json
{
  "plugins": ["@config-plugins/react-native-webrtc"]
}
```

install expo-dev-client:
(don't do this)

```bash
npx expo install expo-dev-client
```

Since the default project App.js has setup light/dark modes we might need expo-system-ui:

```bash
npx expo install expo-system-ui
```

(i didn't install this) actually you should install this

## 3. Install Navigation Dependencies

Install these using:

```bash
npx expo install @react-navigation/native @react-navigation/stack react-native-paper
```

might also need?:

```bash
npx expo install react-native-screens react-native-safe-area-context
```

(i didn't install) actually you should install this

to install:

```bash
npx expo install react-native-gesture-handler
```

to install:

```bash
npx expo install react-native-safe-area-context
```

to install:

```bash
npx expo install react-native-screens
```

## 4. Install Additional Dependencies

Install for LoginScreen using:

```bash
npx expo install @react-native-async-storage/async-storage
```

install CallScreen and permissions.js dependencies using:

```bash
npx expo install react-native-incall-manager react-native-modal react-native-permissions
```

add iOS permissions as a child of react-native-permissions in the app.json config:

```json
"plugins": [
  "@config-plugins/react-native-webrtc",
  [
    "react-native-permissions",
    {
      "iosPermissions": [
        "CAMERA",
        "MICROPHONE"
      ]
    }
  ]
]
```

## 5. Project Files

Move these files into the project:

- App.js
- screens/LoginScreen.jsx
- screens/CallScreen.jsx
- utils/permissions.js

## 6. Running the App

run with:

```bash
npx expo run:android
```

it should launch emulator and start building for android
if you get "Could not connect to TCP port..." type error just rerun

in app.json newArchEnabled should be false cuz it was giving me issues on android
but after rebuilding it is working even though it is set to true
Try to use the newArchEnabled=true if you can cuz its technically the better way of doing things.

## 7. Web Export Setup

(dont do this one)

```bash
npm install --save-dev webpack webpack-cli
```

(don't do this one)

```bash
npm install @expo/webpack-config@0.17.2 --save-dev --legacy-peer-deps
```

This command will export final versions of all 3 platforms

```bash
npx expo export
```

## 8. Environment Variables Support

To use environment variables in React Native with Expo:

1. Create a `.env` file in your project root with UTF-8 encoding (no BOM):

   ```env
   SECRET1=This is my super secret message!
   SIGNALING_SERVER_URL=ws://localhost:8080
   STUN_SERVER_URL=stun:stun.l.google.com:19302
   TURN_SERVER_URL=
   TURN_SERVER_TCP_URL=
   TURN_SERVER_TLS_URL=
   TURN_USERNAME=
   TURN_CREDENTIAL=
   ICE_CANDIDATE_POOL_SIZE=10
   BUNDLE_POLICY=balanced
   RTCP_MUX_POLICY=require
   ICE_TRANSPORT_POLICY=all
   ```

   **Important:** No quotes, no extra spaces, no blank lines at the end.

2. Create or update `app.config.js` in your project root:

   ```js
   const path = require("path");
   require("dotenv").config({ path: path.resolve(__dirname, ".env") });

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
         backgroundColor: "#ffffff",
       },
       ios: {
         supportsTablet: true,
       },
       android: {
         adaptiveIcon: {
           foregroundImage: "./assets/adaptive-icon.png",
           backgroundColor: "#ffffff",
         },
         edgeToEdgeEnabled: true,
       },
       web: {
         favicon: "./assets/favicon.png",
       },
       extra: {
         SECRET1: process.env.SECRET1 || "Fallback secret",
         SIGNALING_SERVER_URL:
           process.env.SIGNALING_SERVER_URL || "ws://localhost:8080",
         STUN_SERVER_URL:
           process.env.STUN_SERVER_URL || "stun:stun.l.google.com:19302",
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
             iosPermissions: ["CAMERA", "MICROPHONE"],
           },
         ],
       ],
     },
   };
   ```

3. Import and use in your App.js:

   ```js
   import { StatusBar } from "expo-status-bar";
   import { StyleSheet, Text, View } from "react-native";
   import Constants from "expo-constants";

   export default function App() {
     return (
       <View style={styles.container}>
         <Text>Open up App.js to start working on your app!</Text>
         <Text>
           Secret: {Constants.expoConfig?.extra?.SECRET1 || "No secret found"}
         </Text>
         <StatusBar style="auto" />
       </View>
     );
   }

   const styles = StyleSheet.create({
     container: {
       flex: 1,
       backgroundColor: "#fff",
       alignItems: "center",
       justifyContent: "center",
     },
   });
   ```

4. For other components (like screens), use the same approach:

   ```js
   import Constants from "expo-constants";

   // Get environment variables from Expo config
   const SIGNALING_SERVER_URL =
     Constants.expoConfig?.extra?.SIGNALING_SERVER_URL;
   const STUN_SERVER_URL = Constants.expoConfig?.extra?.STUN_SERVER_URL;
   ```

**Key Points:**

- Use `app.config.js` (not app.json) for dynamic configuration
- Use `require('dotenv').config()` with explicit path
- Access variables via `Constants.expoConfig.extra.VARIABLE_NAME`
- Make sure .env file has no quotes or extra spaces
- All WebRTC environment variables are now properly configured

## Troubleshooting

- If you encounter issues with the new architecture on Android, try setting `newArchEnabled: false` in your `app.json`
- For TCP connection errors during Android builds, simply rerun the command
- The app should work with `newArchEnabled: true` after a successful rebuild

## ⚠️ CRITICAL: Environment Variable Encoding Issues

**If you see this in terminal:**

```
[dotenv@17.0.0] injecting env (0) from .env
```

**Instead of:**

```
[dotenv@17.0.0] injecting env (11) from .env
```

**Your `.env` file has encoding issues!**

### How to Fix:

1. **Check file encoding in VS Code:**

   - Open `.env` file
   - Bottom right: Click encoding → "Save with encoding" → "UTF-8"
   - Bottom right: Click line endings → "LF" (Unix)

2. **Or fix via PowerShell:**

   ```powershell
   Get-Content .env -Encoding Unicode | Set-Content .env.fixed -Encoding UTF8
   Move-Item .env .env.broken; Move-Item .env.fixed .env
   ```

3. **Restart Expo:**
   ```bash
   npx expo start --clear
   ```

**The number in parentheses shows how many variables loaded:**

- `(0)` = No variables loaded (encoding problem)
- `(11)` = All variables loaded (working correctly)
