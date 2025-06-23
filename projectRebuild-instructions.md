We are going to build a React-Native WebRTC app from scratch
-Shahmir Khan June 23, 2025

First lets create the expo project:
npx create-expo-app WebRTCApp --template blank

we must install using Expo:
npx expo install react-dom react-native-web

Then the Babel plugin for optimization:
npx expo install babel-plugin-react-native-web

Install @expo/metro-runtime@~5.0.4 by running:
npx expo install @expo/metro-runtime

Let's first install react-native-webrtc:
npx expo install react-native-webrtc

Now lets install the web-shim:
npx expo install react-native-webrtc-web-shim

Now lets setup the Expo config plugin:
npx expo install react-native-webrtc @config-plugins/react-native-webrtc

After installing this npm package, add the config plugin to the plugins array of your app.json or app.config.js:
{
"plugins": ["@config-plugins/react-native-webrtc"]
}

install expo-dev-client:
npx expo install expo-dev-client

Since the default project App.js has setup light/dark modes we might need expo-system-ui:
npx expo install expo-system-ui (i didn't install this)

Install these using:
npx expo install @react-navigation/native @react-navigation/stack react-native-paper

might also need?:
npx expo install react-native-screens react-native-safe-area-context (i didn't install)

to install:
npx expo install react-native-gesture-handler

to install:
npx expo install react-native-safe-area-context

to install:
npx expo install react-native-screens

Install for LoginScreen using:
npx expo install @react-native-async-storage/async-storage

install CallScreen and permissions.js dependencies using:
npx expo install react-native-incall-manager react-native-modal react-native-permissions

add iOS permissions as a child of react-native-permissions in the app.json config:

```
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

Move these files into the project:
App.js
screens/LoginScreen.jsx
screens/CallScreen.jsx
utils/permissions.js

run with:
npx expo run:android

it should launch emulator and start building for android
if you get "Could not connect to TCP port..." type error just rerun

in app.json newArchEnabled should be false cuz it was giving me issues on android
but after rebuilding it is working even though it is set to true
Try to use the newArchEnabled=true if you can cuz its technically the better way of doing things.
