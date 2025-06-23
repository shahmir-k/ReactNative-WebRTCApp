// Shahmir Khan June 23, 2025
// Github: https://github.com/shahmir-k
// LinkedIn: https://www.linkedin.com/in/shahmir-k

import { Platform, Alert } from 'react-native';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

// Web device enumeration helper
const enumerateDevices = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.log('Device enumeration not supported');
      return;
    }
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const audioDevices = devices.filter(device => device.kind === 'audioinput');
    
    console.log('Available video devices:', videoDevices.length);
    console.log('Available audio devices:', audioDevices.length);
    
    return { videoDevices, audioDevices };
  } catch (error) {
    console.log('Error enumerating devices:', error);
  }
};

// Web permission helpers
const requestWebPermission = async (permissionName) => {
  try {
    // Check if mediaDevices is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      Alert.alert('Error', 'Media devices not supported in this browser');
      return false;
    }

    // Enumerate devices first to check availability
    const deviceInfo = await enumerateDevices();
    const deviceCount = permissionName === 'camera' 
      ? (deviceInfo && deviceInfo.videoDevices ? deviceInfo.videoDevices.length : 0)
      : (deviceInfo && deviceInfo.audioDevices ? deviceInfo.audioDevices.length : 0);
    
    console.log(`Found ${deviceCount} ${permissionName} devices`);

    // Always try to get user media first to trigger permission prompt
    const constraints = permissionName === 'camera' 
      ? { video: true, audio: false }
      : { video: false, audio: true };
    
    console.log(`Requesting ${permissionName} with constraints:`, constraints);
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Stop the test stream immediately
    stream.getTracks().forEach(track => {
      track.stop();
      console.log(`Stopped ${track.kind} track`);
    });
    
    // Now check the permission state for future reference
    if (navigator.permissions) {
      try {
        const permission = await navigator.permissions.query({ name: permissionName });
        console.log(`${permissionName} permission state:`, permission.state);
      } catch (permError) {
        console.log(`Could not query ${permissionName} permission state:`, permError);
      }
    }
    
    console.log(`${permissionName} permission granted successfully`);
    return true;
  } catch (error) {
    console.log(`Error requesting ${permissionName} permission on web:`, error);
    
    // Check if it's a permission denied error
    if (error && error.name) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        Alert.alert('Permission Required', `${permissionName} permission is required for this app to work`);
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        Alert.alert('Device Not Found', `${permissionName} device not found on this device`);
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        Alert.alert('Device Busy', `${permissionName} device is currently in use by another application`);
      } else if (error.name === 'OverconstrainedError') {
        Alert.alert('Device Constraint Error', `${permissionName} device does not meet the required constraints`);
      } else if (error.name === 'TypeError') {
        Alert.alert('Invalid Request', `Invalid ${permissionName} request parameters`);
      } else {
        Alert.alert('Error', `Failed to access ${permissionName}: ${error.message}`);
      }
    } else {
      Alert.alert('Error', `Failed to access ${permissionName}`);
    }
    
    return false;
  }
};

const requestCameraPermission = async () => {
  // Handle web platform
  if (Platform.OS === 'web') {
    return await requestWebPermission('camera');
  }

  // Handle native platforms
  try {
    const permission = Platform.select({
      ios: PERMISSIONS.IOS.CAMERA,
      android: PERMISSIONS.ANDROID.CAMERA,
    });

    if (!permission) {
      Alert.alert('Error', 'Camera permission not available for this platform');
      return false;
    }

    const result = await request(permission);
    
    switch (result) {
      case RESULTS.UNAVAILABLE:
        Alert.alert('Error', 'Camera is not available on this device');
        return false;
      case RESULTS.DENIED:
        Alert.alert('Permission Required', 'Camera permission is required for video calls');
        return false;
      case RESULTS.LIMITED:
        return true;
      case RESULTS.GRANTED:
        return true;
      case RESULTS.BLOCKED:
        Alert.alert('Permission Blocked', 'Camera permission is blocked. Please enable it in settings.');
        return false;
      default:
        return false;
    }
  } catch (error) {
    console.log('Error requesting camera permission:', error);
    return false;
  }
};

const requestMicrophonePermission = async () => {
  // Handle web platform
  if (Platform.OS === 'web') {
    return await requestWebPermission('microphone');
  }

  // Handle native platforms
  try {
    const permission = Platform.select({
      ios: PERMISSIONS.IOS.MICROPHONE,
      android: PERMISSIONS.ANDROID.RECORD_AUDIO,
    });

    if (!permission) {
      Alert.alert('Error', 'Microphone permission not available for this platform');
      return false;
    }

    const result = await request(permission);
    
    switch (result) {
      case RESULTS.UNAVAILABLE:
        Alert.alert('Error', 'Microphone is not available on this device');
        return false;
      case RESULTS.DENIED:
        Alert.alert('Permission Required', 'Microphone permission is required for audio calls');
        return false;
      case RESULTS.LIMITED:
        return true;
      case RESULTS.GRANTED:
        return true;
      case RESULTS.BLOCKED:
        Alert.alert('Permission Blocked', 'Microphone permission is blocked. Please enable it in settings.');
        return false;
      default:
        return false;
    }
  } catch (error) {
    console.log('Error requesting microphone permission:', error);
    return false;
  }
};

const requestAllPermissions = async () => {
  const cameraPermission = await requestCameraPermission();
  const microphonePermission = await requestMicrophonePermission();
  
  return cameraPermission && microphonePermission;
};

export { requestAllPermissions, requestCameraPermission, requestMicrophonePermission }; 