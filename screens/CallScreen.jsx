// Shahmir Khan June 23, 2025
// Github: https://github.com/shahmir-k
// LinkedIn: https://www.linkedin.com/in/shahmir-k

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Alert, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Card, IconButton } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import InCallManager from 'react-native-incall-manager';
import Modal from 'react-native-modal';
import {
  RTCPeerConnection, //used for all platforms
  RTCIceCandidate, //used for all platforms
  RTCSessionDescription, //used for all platforms
  RTCView, //used for all platforms
  mediaDevices, //used for all platforms

  MediaStream, //used, for all platforms

  registerGlobals, //not used, for all platforms
  MediaStreamTrack, //not used, for all platforms
  RTCRtpTransceiver, //not used, web only
  RTCRtpReceiver, //not used, web only
  RTCRtpSender, //not used, web only
  RTCErrorEvent, //not used, web only
  permissions, //not used, web only
} from 'react-native-webrtc-web-shim';

import { requestAllPermissions } from '../utils/permissions';
import Constants from 'expo-constants';

import { Icon, ActivityIndicator } from 'react-native-paper';

// Get environment variables from Expo config
const {
  SIGNALING_SERVER_URL,
  STUN_SERVER_URL,
  TURN_SERVER_URL,
  TURN_SERVER_TCP_URL,
  TURN_SERVER_TLS_URL,
  TURN_USERNAME,
  TURN_CREDENTIAL,
  ICE_CANDIDATE_POOL_SIZE,
  BUNDLE_POLICY,
  RTCP_MUX_POLICY,
  ICE_TRANSPORT_POLICY
} = Constants.expoConfig?.extra || {};

// ICE server configuration using environment variables
const ICE_SERVERS = [
  // Primary STUN server for local network discovery
  {
    urls: STUN_SERVER_URL,
  },
  // TURN UDP
  {
    urls: TURN_SERVER_URL,
    username: TURN_USERNAME,
    credential: TURN_CREDENTIAL,
  },
  // TURN TCP
  {
    urls: TURN_SERVER_TCP_URL,
    username: TURN_USERNAME,
    credential: TURN_CREDENTIAL,
  },
  // TURN TLS
  {
    urls: TURN_SERVER_TLS_URL,
    username: TURN_USERNAME,
    credential: TURN_CREDENTIAL,
  },
];

export default function CallScreen({ navigation }) {
  // State management for user interface and call status
  const [userId, setUserId] = useState('');
  const [socketActive, setSocketActive] = useState(false);
  const [calling, setCalling] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const permissionsGrantedRef = useRef(false);
  const [error, setError] = useState('');

  // WebSocket connection for signaling server communication
  const conn = useRef(null);

  // WebRTC peer connection for media streaming
  const yourConn = useRef(
    new RTCPeerConnection({
      iceServers: ICE_SERVERS, // Use the enhanced ICE server configuration
      iceCandidatePoolSize: parseInt(ICE_CANDIDATE_POOL_SIZE), // Pre-gather more ICE candidates for faster connection establishment
      bundlePolicy: BUNDLE_POLICY, // Bundle all media streams for efficiency
      rtcpMuxPolicy: RTCP_MUX_POLICY, // Require RTCP multiplexing for better compatibility
      iceTransportPolicy: ICE_TRANSPORT_POLICY, // Allow all types of ICE candidates (host, srflx, relay)
    })
  );

  // Call state management
  const [callActive, setCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const [otherId, setOtherId] = useState('');
  const [callToUsername, setCallToUsername] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const connectedUser = useRef(null);
  const offerRef = useRef(null);
  const userIdRef = useRef('');
  const callActiveRef = useRef(false);

  // ICE candidate queue to handle timing issues
  // This prevents "No remoteDescription" errors by queuing ICE candidates
  // until the remote description is set, which is required before adding candidates
  const iceCandidateQueue = useRef([]);
  // Track whether remote description has been set to know when it's safe to add ICE candidates
  const remoteDescriptionSet = useRef(false);

  // Track actual media streams with refs to ensure we can always access them for cleanup
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  // Added for local preview
  const [localPreviewStream, setLocalPreviewStream] = useState(null);

  /**
   * Check if user is logged in and navigate to login if not
   * Runs when screen comes into focus
   */
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('userId').then((id) => {
        console.log(id);
        if (id) {
          setUserId(id);
          userIdRef.current = id; // Update ref when userId changes
        } else {
          setUserId('');
          userIdRef.current = '';
          navigation.navigate('Login');
        }
      });
    }, [navigation])
  );

  /**
   * Check permissions and initialize local video if granted
   * Can be called from multiple places to ensure video is available
   */
  const checkPermissionsAndInitVideo = async () => {
    console.log('🔍 Checking permissions...');
    const granted = await requestAllPermissions();
    setPermissionsGranted(granted);
    permissionsGrantedRef.current = granted;
    if (granted) {
      console.log('🎥 Initializing local video...');
      initLocalVideo();
      return true;
    } else {
      console.log('🚫 Permissions not granted, cannot initialize video');
      if (Platform.OS === 'web') {
        window.alert('Camera and microphone permissions are required to make calls');
      } else {
        Alert.alert('Permissions Required', 'Camera and microphone permissions are required to make calls');
      }
      return false;
    }
  };

  /**
   * Initialize camera and microphone permissions and local video stream
   * Runs once when component mounts
   */
  useEffect(() => {
    checkPermissionsAndInitVideo();

    // Cleanup function that runs when component unmounts
    return () => {
      console.log('🔄 Component unmounting - cleaning up media');
      cleanupAllMedia();
    };
  }, []);

  /**
   * Update navigation header with user ID and logout button
   * Runs when userId changes
   */
  useEffect(() => {
    navigation.setOptions({
      title: 'Your ID - ' + userId,
      headerRight: () => (
        <Button mode="text" onPress={onLogout} style={{ paddingRight: 10 }}>Logout</Button>
      ),
      headerLeft: () => (
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={onLogout}
          style={{ marginLeft: 10 }}
        />
      ),
    });
  }, [userId, navigation]);

  /**
   * Initialize InCallManager for mobile devices and send join message to signaling server
   * Runs when socket becomes active and userId is available
   */
  useEffect(() => {
    if (socketActive && userId.length > 0) {
      if (Platform.OS !== 'web') {
        try {
          InCallManager.start({ media: 'audio' });
          InCallManager.setForceSpeakerphoneOn(true);
          InCallManager.setSpeakerphoneOn(true);
        } catch (err) {
          console.log('InApp Caller ---------------------->', err);
        }
      }

      // Register peer events after userId is set
      registerPeerEvents();

      // Fetch available users
      fetchAvailableUsers();
    }
  }, [socketActive, userId]);

  /**
   * Initialize WebSocket connection - reuse from login if available
   * Runs when component mounts
   */
  useEffect(() => {
    // Check if we have a WebSocket from login
    if (global && global.loginWebSocket) {
      console.log('🔗 Reusing WebSocket connection from login');
      conn.current = global.loginWebSocket;
      global.loginWebSocket = null; // Clear the global reference

      // If the reused WebSocket is already connected, set socketActive immediately
      if (conn.current.readyState === WebSocket.OPEN) {
        console.log('🔗 Reused WebSocket is already connected');
        setSocketActive(true);
      }
    } else {
      console.log('🔗 Creating new WebSocket connection');
      conn.current = new WebSocket(SIGNALING_SERVER_URL);
    }
  }, []);

  /**
   * Set up WebSocket event handlers for signaling server communication
   * Runs once when component mounts
   */
  useEffect(() => {
    if (!conn.current) return; // Wait for connection to be initialized

    conn.current.onopen = () => {
      console.log('🔗 Connected to the signaling server');
      setSocketActive(true);
    };

    conn.current.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      console.log('📨 Received message from server:', data);
      switch (data.type) {
        case 'join':
          console.log('👥 User joined:', data);
          break;
        case 'offer':
          console.log('📞 Received offer from:', data.sender);
          handleOffer(data.data, data.sender);
          break;
        case 'answer':
          console.log('✅ Received answer from:', data.sender);
          handleAnswer(data.data);
          break;
        case 'candidate':
          console.log('🧊 Received ICE candidate from:', data.sender);
          handleCandidate(data.data);
          break;
        case 'hangUp':
          console.log('👋 User hung up:', data);
          handleHangUp();
          break;
        case 'activeUsers':
          console.log('👥 Active users:', data);
          if (data.data && data.data.users) {
            const userNames = data.data.users.map((user) => user.name);
            setAvailableUsers(userNames);
          }
          break;
        default:
          console.log('❓ Unknown message type:', data.type);
          break;
      }
    };

    conn.current.onerror = function (err) {
      console.log('❌ WebSocket error:', err);
    };

    conn.current.onclose = function (event) {
      console.log('🔌 WebSocket closed:', event.code, event.reason);
      setSocketActive(false);
    };
  }, [conn.current]); // Re-run when connection changes

  /**
   * Manage InCallManager state based on call status (mobile only)
   * Runs when callActive state changes
   */
  useEffect(() => {
    if (!callActive) {
      if (Platform.OS !== 'web') {
        InCallManager.stop();
      }
    } else {
      if (Platform.OS !== 'web') {
        InCallManager.setSpeakerphoneOn(true);
      }
    }
  }, [callActive]);

  /**
   * Register WebRTC peer connection event handlers
   * Handles remote stream addition and ICE candidate generation
   */
  const registerPeerEvents = () => {
    // Handle remote stream addition (legacy method)
    yourConn.current.onaddstream = (event) => {
      console.log('📹 Remote stream received:', event.stream);
      setRemoteStream(event.stream);
      remoteStreamRef.current = event.stream; // Store in ref for reliable cleanup
    };

    // Handle remote track addition (modern method, especially for web)
    yourConn.current.ontrack = (event) => {
      console.log('📹 Remote track received:', event.track);
      if (event.streams && event.streams[0]) {
        console.log('📹 Setting remote stream from track event');
        setRemoteStream(event.streams[0]);
        remoteStreamRef.current = event.streams[0]; // Store in ref for reliable cleanup
      }
    };

    // Handle ICE candidate generation for signaling
    yourConn.current.onicecandidate = (event) => {
      if (event.candidate) {
        send({
          type: 'candidate',
          sender: userIdRef.current,
          receiver: connectedUser.current,
          data: event.candidate,
        });
      }
    };

    // Monitor connection state changes
    // This helps track the overall WebRTC connection status
    yourConn.current.onconnectionstatechange = () => {
      console.log('🔗 Connection state changed:', yourConn.current.connectionState);
      if (yourConn.current.connectionState === 'failed') {
        console.log('❌ WebRTC connection failed');
        // Optionally reset the connection
        // handleHangUp();
      }
    };

    // Monitor ICE connection state changes
    // This tracks the ICE connection establishment process
    yourConn.current.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', yourConn.current.iceConnectionState);
      if (yourConn.current.iceConnectionState === 'failed') {
        console.log('❌ ICE connection failed');
        setError('ICE connection failed - check your network and TURN server configuration');
        // Optionally reset the connection after a delay
        setTimeout(() => {
          if (yourConn.current.iceConnectionState === 'failed') {
            console.log('🔄 Resetting connection due to ICE failure');
            handleHangUp();
          }
        }, 5000);
      } else if (yourConn.current.iceConnectionState === 'connected') {
        console.log('✅ ICE connection established successfully');
        setError(''); // Clear any previous ICE errors
      } else if (yourConn.current.iceConnectionState === 'checking') {
        console.log('🔍 ICE connection checking - gathering candidates...');
      } else if (yourConn.current.iceConnectionState === 'disconnected') {
        console.log('⚠️ ICE connection disconnected');
        setError('Connection lost - attempting to reconnect...');
      }
    };

    // Monitor ICE gathering state changes
    // This tracks the process of collecting ICE candidates
    yourConn.current.onicegatheringstatechange = () => {
      console.log('🔍 ICE gathering state:', yourConn.current.iceGatheringState);
    };

    // Monitor signaling state changes
    // This tracks the SDP offer/answer exchange process
    yourConn.current.onsignalingstatechange = () => {
      console.log('📡 Signaling state:', yourConn.current.signalingState);
    };
  };

  /**
   * Reset WebRTC peer connection
   * Creates new peer connection and registers event handlers
   * @param restartVideo - Whether to restart video after reset (default: true)
   */
  const resetPeer = (restartVideo = false) => {
    console.log('🔄 resetPeer called');

    // Reset ICE candidate handling state for the new peer connection
    // This ensures we start fresh with each new call attempt
    iceCandidateQueue.current = [];
    remoteDescriptionSet.current = false;

    yourConn.current = new RTCPeerConnection({
      iceServers: ICE_SERVERS, // Use the enhanced ICE server configuration
      iceCandidatePoolSize: parseInt(ICE_CANDIDATE_POOL_SIZE), // Pre-gather more ICE candidates for faster connection establishment
      bundlePolicy: BUNDLE_POLICY, // Bundle all media streams for efficiency
      rtcpMuxPolicy: RTCP_MUX_POLICY, // Require RTCP multiplexing for better compatibility
      iceTransportPolicy: ICE_TRANSPORT_POLICY, // Allow all types of ICE candidates (host, srflx, relay)
    });
    console.log('🆕 New RTCPeerConnection created and assigned to yourConn.current');
    registerPeerEvents();
    console.log('🔗 Peer events registered');

  };

  const fetchAvailableUsers = () => {
    if (conn.current && conn.current.readyState === WebSocket.OPEN) {
      send({
        type: 'activeUsers',
        sender: userIdRef.current,
      });
    }
  };

  /**
   * Initialize local video stream using camera and microphone
   * Creates media stream and adds tracks to peer connection
   */
  const initLocalVideo = () => {
    console.log('🎥 initLocalVideo CALLED: permissionsGranted (state):', permissionsGranted, '| (ref):', permissionsGrantedRef.current);

    // Use web-compatible constraints
    const constraints = Platform.OS === 'web'
      ? {
        audio: true,
        video: {
          width: { min: 500, ideal: 1280, max: 1920 },
          height: { min: 300, ideal: 720, max: 1080 },
          frameRate: { min: 30, ideal: 30 },
          facingMode: 'user'
        }
      }
      : {
        audio: true,
        video: {
          // Native React Native WebRTC constraints
          mandatory: {
            minWidth: 500,
            minHeight: 300,
            minFrameRate: 30,
          },
          facingMode: 'user',
        },
      };

    console.log('Getting user media with constraints:', constraints);

    mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        console.log('Local stream obtained:', stream);
        // Store stream in both state and ref for reliable cleanup
        setLocalStream(stream);
        localStreamRef.current = stream;

        // Add tracks to peer connection
        stream.getTracks().forEach(track => {
          console.log('Adding track to peer connection:', track.kind);
          yourConn.current.addTrack(track, stream);
        });

        // For local preview, create a video-only stream
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoOnlyStream = new MediaStream([videoTracks[0]]);
          setLocalPreviewStream(videoOnlyStream);
        }
      })
      .catch((error) => {
        console.log('Error accessing camera', error);
        Alert.alert('Error', 'Failed to access camera and microphone');
      });
  };

  /**
   * Send message to signaling server via WebSocket
   * @param message - The message object to send
   */
  const send = (message) => {
    if (!conn.current) {
      console.log('❌ WebSocket not connected, cannot send message');
      return;
    }

    // Ensure sender field is always present
    if (!message.sender) {
      message.sender = userIdRef.current;
    }
    console.log('📤 Sending message to server:', message);
    conn.current.send(JSON.stringify(message));
  };

  /**
   * Initiate a call to another user
   * Creates and sends offer to signaling server
   * @param user - Optional user ID to call, defaults to callToUsername
   */
  const startCalling = async (user = callToUsername) => {
    //if (!permissionsGrantedRef.current) {
    //  Alert.alert('Permissions Required', 'Camera and microphone permissions are required to make calls');
    //  return;
    //}
    user = (user || '').toString().trim();
    console.log('user: ', user);
    console.log('error: ', error);
    if (user === '') {
      setError('Please enter a valid user ID');
      return;
    }
    if (user === userIdRef.current) {
      setError('You cannot call yourself');
      return;
    }
    if (user === connectedUser.current) {
      setError('You are already calling this user');
      return;
    }
    if (callActive) {
      setError('You are already in a call');
      return;
    }
    if (!socketActive) {
      setError('WebSocket is not active');
      return;
    }

    setError('');
    const granted = await checkPermissionsAndInitVideo();
    if (granted) {
      sendCallOffer(user);

      // Set up connection timeout to handle cases where the remote user doesn't respond
      // This prevents the call from hanging indefinitely
      const connectionTimeout = setTimeout(() => {
        if (!callActiveRef.current) {
          console.log('⏰ Connection timeout - no response received');
          setError('Call timeout - no response from user');
          setCalling(false);
          handleHangUp();
        }
      }, 30000); // 30 second timeout

      // Clear timeout when call becomes active to prevent false timeouts
      const checkCallActive = setInterval(() => {
        if (callActiveRef.current) {
          clearTimeout(connectionTimeout);
          clearInterval(checkCallActive);
        }
      }, 1000);

      // Clean up interval after 35 seconds to prevent memory leaks
      setTimeout(() => {
        clearInterval(checkCallActive);
      }, 35000);
    }

    return;

  };

  /**
   * Create and send WebRTC offer to initiate call
   * @param receiverId - The ID of the user to call
   */
  const sendCallOffer = (receiverId) => {
    setCalling(true);
    const otherUser = receiverId;
    connectedUser.current = otherUser;
    console.log('Calling to', otherUser);
    setOtherId(otherUser);


    yourConn.current.createOffer().then((offer) => {
      yourConn.current.setLocalDescription(offer).then(() => {
        console.log('Sending Offer');
        send({
          type: 'offer',
          sender: userIdRef.current,
          receiver: otherUser,
          data: offer,
        });
      });
    });
  };

  /**
   * Handle incoming call offer from another user
   * @param offer - The WebRTC offer object
   * @param name - The name/ID of the calling user
   */
  const handleOffer = async (offer, name) => {
    console.log(name + ' is calling you.');
    connectedUser.current = name;
    offerRef.current = { name, offer };
    setIncomingCall(true);
    setOtherId(name);
    if (callActive) acceptCall();
  };

  /**
   * Accept an incoming call
   * Creates and sends answer to the calling user
   */
  const acceptCall = async () => {
    const name = offerRef.current.name;
    const offer = offerRef.current.offer;
    setIncomingCall(false);
    setCallActive(true);
    callActiveRef.current = true;
    console.log('Accepting CALL', name, offer);

    try {
      await yourConn.current.setRemoteDescription(offer);
      // Mark that remote description is set so we can safely add ICE candidates
      remoteDescriptionSet.current = true;

      // Process any queued ICE candidates that arrived before we set the remote description
      while (iceCandidateQueue.current.length > 0) {
        const candidate = iceCandidateQueue.current.shift();
        await yourConn.current.addIceCandidate(new RTCIceCandidate(candidate));
      }

      const answer = await yourConn.current.createAnswer();
      await yourConn.current.setLocalDescription(answer);
      send({
        type: 'answer',
        sender: userIdRef.current,
        receiver: connectedUser.current,
        data: answer,
      });
    } catch (err) {
      console.log('Error accepting call', err);
    }
  };

  /**
   * Handle incoming answer to our offer
   * @param answer - The WebRTC answer object
   */
  const handleAnswer = (answer) => {
    setCalling(false);
    setCallActive(true);
    callActiveRef.current = true;
    yourConn.current.setRemoteDescription(new RTCSessionDescription(answer))
      .then(() => {
        // Mark that remote description is set so we can safely add ICE candidates
        remoteDescriptionSet.current = true;
        // Process any queued ICE candidates that arrived before the remote description
        while (iceCandidateQueue.current.length > 0) {
          const candidate = iceCandidateQueue.current.shift();
          yourConn.current.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(err => console.log('Error adding queued ICE candidate:', err));
        }
      })
      .catch(err => console.log('Error setting remote description:', err));
  };

  /**
   * Handle incoming ICE candidate
   * @param candidate - The ICE candidate object
   */
  const handleCandidate = (candidate) => {
    setCalling(false);

    // If remote description is not set yet, queue the candidate
    // This prevents "No remoteDescription" errors that occur when ICE candidates
    // arrive before the SDP offer/answer exchange is complete
    if (!remoteDescriptionSet.current) {
      console.log('📋 Queuing ICE candidate - remote description not set yet');
      iceCandidateQueue.current.push(candidate);
      return;
    }

    // Otherwise, add the candidate immediately since remote description is set
    yourConn.current.addIceCandidate(new RTCIceCandidate(candidate))
      .catch(err => console.log('Error adding ICE candidate:', err));
  };

  /**
   * Check if any media tracks are still active
   * Returns true if any tracks are still running
   */
  const checkAllMediaActive = (localStreamToCheck, remoteStreamToCheck) => {
    // Use provided streams or fall back to refs, then state
    const currentLocal = localStreamToCheck || localStreamRef.current || localStream;
    const currentRemote = remoteStreamToCheck || remoteStreamRef.current || remoteStream;

    let hasActiveTracks = false;

    if (currentLocal) {
      const tracks = currentLocal.getTracks();
      tracks.forEach(track => {
        if (track.readyState === 'live') {
          console.log(`⚠️ Active local track found: ${track.kind} (${track.id})`);
          hasActiveTracks = true;
        }
      });
    }

    if (currentRemote) {
      const tracks = currentRemote.getTracks();
      tracks.forEach(track => {
        if (track.readyState === 'live') {
          console.log(`⚠️ Active remote track found: ${track.kind} (${track.id})`);
          hasActiveTracks = true;
        }
      });
    }

    return hasActiveTracks;
  };

  /**
   * Stop all media streams globally (web-specific)
   * This is a more aggressive approach to ensure all media is stopped
   */
  const stopAllMediaGlobally = () => {
    if (Platform.OS !== 'web') return;

    console.log('🌐 Stopping all media streams globally (web)');

    // Get streams from refs first, then fall back to state
    const currentLocalStream = localStreamRef.current || localStream;
    const currentRemoteStream = remoteStreamRef.current || remoteStream;

    // Stop all tracks from our known streams
    if (currentLocalStream) {
      const tracks = currentLocalStream.getTracks();
      tracks.forEach(track => {
        console.log(`🛑 Stopping global track: ${track.kind} (${track.id})`);
        track.stop();
      });
    }

    if (currentRemoteStream) {
      const tracks = currentRemoteStream.getTracks();
      tracks.forEach(track => {
        console.log(`🛑 Stopping global remote track: ${track.kind} (${track.id})`);
        track.stop();
      });
    }

    // Also try to stop any active streams from getUserMedia
    try {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          console.log('🛑 Found active stream, stopping all tracks');
          stream.getTracks().forEach(track => {
            console.log(`🛑 Stopping global track: ${track.kind} (${track.id})`);
            track.stop();
          });
        })
        .catch(err => {
          // This is expected if no active streams
          console.log('✅ No active getUserMedia streams found');
        });
    } catch (err) {
      console.log('⚠️ Error in global media cleanup:', err);
    }
  };

  /**
   * Force stop all media as a final measure
   * This is the most aggressive cleanup method
   */
  const forceStopAllMedia = () => {
    console.log('🛑 Force stopping all media streams');

    // Get streams from refs first, then fall back to state
    const currentLocalStream = localStreamRef.current || localStream;
    const currentRemoteStream = remoteStreamRef.current || remoteStream;

    // Force stop all tracks from our known streams
    if (currentLocalStream) {
      const tracks = currentLocalStream.getTracks();
      tracks.forEach(track => {
        if (track.readyState === 'live') {
          console.log(`🛑 Force stopping local track: ${track.kind} (${track.id})`);
          track.stop();
        }
      });
    }

    if (currentRemoteStream) {
      const tracks = currentRemoteStream.getTracks();
      tracks.forEach(track => {
        if (track.readyState === 'live') {
          console.log(`🛑 Force stopping remote track: ${track.kind} (${track.id})`);
          track.stop();
        }
      });
    }

    // Try to find and stop any remaining streams
    if (Platform.OS === 'web') {
      try {
        // This will find any remaining active streams
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            console.log('🛑 Found remaining stream, stopping all tracks');
            stream.getTracks().forEach(track => {
              console.log(`🛑 Force stopping remaining track: ${track.kind} (${track.id})`);
              track.stop();
            });
          })
          .catch(err => {
            console.log('✅ No remaining streams found');
          });
      } catch (err) {
        console.log('⚠️ Error in force stop:', err);
      }
    }
  };

  /**
   * Comprehensive cleanup function to stop all media and reset state
   * This should be called when logging out or when the component unmounts
   */
  const cleanupAllMedia = () => {
    console.log('🧹 Starting comprehensive media cleanup');

    // Check if media is active before cleanup
    const wasActive = checkAllMediaActive(localStream, remoteStream);
    if (wasActive) {
      console.log('📹 Media was active - performing cleanup');
    }

    // Capture the current streams from refs (more reliable than state)
    const currentLocalStream = localStreamRef.current || localStream;
    const currentRemoteStream = remoteStreamRef.current || remoteStream;

    console.log('📹 Current local stream (ref):', currentLocalStream ? 'exists' : 'null');
    console.log('📹 Current remote stream (ref):', currentRemoteStream ? 'exists' : 'null');

    // First, remove all tracks from the peer connection
    if (yourConn.current) {
      console.log('🔌 Removing tracks from peer connection');
      try {
        const senders = yourConn.current.getSenders();
        console.log(`📹 Found ${senders.length} senders in peer connection`);
        senders.forEach(sender => {
          if (sender.track) {
            console.log(`🛑 Removing track from peer connection: ${sender.track.kind} (${sender.track.id})`);
            yourConn.current.removeTrack(sender);
          }
        });
      } catch (err) {
        console.log('⚠️ Error removing tracks from peer connection:', err);
      }
    }

    // Stop all local stream tracks (camera and microphone)
    if (currentLocalStream) {
      console.log('📹 Stopping local stream tracks');
      const tracks = currentLocalStream.getTracks();
      console.log(`📹 Found ${tracks.length} local tracks to stop`);
      tracks.forEach(track => {
        console.log(`🛑 Stopping track: ${track.kind} (${track.id}) - state: ${track.readyState}`);
        track.stop();
        console.log(`✅ Track ${track.kind} stopped - new state: ${track.readyState}`);
      });
    } else {
      console.log('⚠️ No local stream found to stop');
    }

    // Stop all remote stream tracks
    if (currentRemoteStream) {
      console.log('📹 Stopping remote stream tracks');
      const tracks = currentRemoteStream.getTracks();
      console.log(`📹 Found ${tracks.length} remote tracks to stop`);
      tracks.forEach(track => {
        console.log(`🛑 Stopping remote track: ${track.kind} (${track.id}) - state: ${track.readyState}`);
        track.stop();
        console.log(`✅ Remote track ${track.kind} stopped - new state: ${track.readyState}`);
      });
    } else {
      console.log('⚠️ No remote stream found to stop');
    }

    // Try global media cleanup (web-specific)
    stopAllMediaGlobally();

    // Force stop all media as a final measure
    forceStopAllMedia();

    // Close the peer connection and remove all event handlers
    if (yourConn.current) {
      console.log('🔌 Closing peer connection');
      yourConn.current.onicecandidate = null;
      yourConn.current.onaddstream = null;
      yourConn.current.ontrack = null;
      yourConn.current.onconnectionstatechange = null;
      yourConn.current.oniceconnectionstatechange = null;
      yourConn.current.onicegatheringstatechange = null;
      yourConn.current.onsignalingstatechange = null;
      yourConn.current.close();
    }
    yourConn.current = null;

    // Reset all call-related state
    setCalling(false);
    setIncomingCall(false);
    setCallActive(false);
    callActiveRef.current = false;
    setOtherId('');
    setCallToUsername('');
    setError('');
    offerRef.current = null;
    connectedUser.current = null;

    // Reset ICE candidate handling state
    iceCandidateQueue.current = [];
    remoteDescriptionSet.current = false;

    // Set streams to null after stopping tracks
    setLocalStream(null);
    setLocalPreviewStream(null);
    setRemoteStream(null);
    localStreamRef.current = null;
    remoteStreamRef.current = null;

    // Verify cleanup was successful
    if (true) {
      setTimeout(() => {
        const stillActive = checkAllMediaActive(currentLocalStream, currentRemoteStream);
        if (stillActive) {
          console.warn('⚠️ Media tracks still active after cleanup - attempting force stop');
          // Force stop any remaining tracks
          if (currentLocalStream) {
            currentLocalStream.getTracks().forEach(track => {
              if (track.readyState === 'live') {
                console.log(`🛑 Force stopping track: ${track.kind} (${track.id})`);
                track.stop();
              }
            });
          }
          if (currentRemoteStream) {
            currentRemoteStream.getTracks().forEach(track => {
              if (track.readyState === 'live') {
                console.log(`🛑 Force stopping remote track: ${track.kind} (${track.id})`);
                track.stop();
              }
            });
          }
        } else {
          console.log('✅ Media cleanup verification successful - all tracks stopped');
        }

        // Final verification - check if we can still access camera (should fail if properly stopped)
        if (Platform.OS === 'web') {
          setTimeout(() => {
            console.log('🔍 Final camera accessibility check...');
            navigator.mediaDevices.getUserMedia({ video: true, audio: false })
              .then(stream => {
                console.warn('⚠️ Camera is still accessible after cleanup - this indicates a problem');
                console.warn('⚠️ Attempting to stop any remaining tracks...');
                stream.getTracks().forEach(track => {
                  console.log(`🛑 Stopping remaining track: ${track.kind} (${track.id})`);
                  track.stop();
                });
              })
              .catch(err => {
                console.log('✅ Camera is properly stopped - cannot access camera (good!)');
              });
          }, 2000);
        }
      }, 1000);
    }
    console.log('✅ Media cleanup completed');
  };

  /**
   * End current call and clean up resources
   * Resets all call state and peer connection
   */
  const handleHangUp = () => {
    console.log('📞 handleHangUp called - sending hangUp message');
    send({
      type: 'hangUp',
      sender: userIdRef.current,
      receiver: connectedUser.current,
    });

    setCalling(false);
    setIncomingCall(false);
    setCallActive(false);
    callActiveRef.current = false;
    setOtherId('');
    setCallToUsername('');
    offerRef.current = null;
    connectedUser.current = null;
    setRemoteStream(null);
    // Stop all tracks of the local stream before setting to null
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setLocalPreviewStream(null);
    yourConn.current.onicecandidate = null;
    yourConn.current.onaddstream = null;
    yourConn.current.ontrack = null;

    // Create a new peer connection for future calls
    resetPeer();
    checkPermissionsAndInitVideo();
  };

  /**
   * Handle logout by sending leave message to backend
   * Notifies server that user is leaving
   */
  const handleLogout = () => {
    console.log('🚪 handleLogout called - sending leave message');
    send({
      type: 'leave',
      sender: userIdRef.current,
    });
  };

  /**
   * Logout user and navigate to login screen
   * Cleans up call state and removes user ID from storage
   */
  const onLogout = () => {
    console.log('🚪 onLogout called - starting comprehensive cleanup');

    // First, send hangup message if in a call
    if (callActiveRef.current || true) {
      send({
        type: 'hangUp',
        sender: userIdRef.current,
        receiver: connectedUser.current,
      });
    }


    // Send leave message to notify server
    // dont send leave message it is deprecated handleLogout();

    // Perform comprehensive media cleanup
    cleanupAllMedia();

    // Close WebSocket connection if it exists
    // conn.current holds our WebSocket connection to the signaling server
    // that handles call setup and peer coordination
    // The ? is the optional chaining operator - it only calls close() 
    // if conn.current exists, preventing errors if the connection is null
    if (conn.current) {
      console.log('🔌 Closing WebSocket connection');
      conn.current.close();
      conn.current = null;
    }

    // Remove user ID from storage and navigate to login
    AsyncStorage.removeItem('userId').then((res) => {
      console.log('✅ Logout completed - navigating to login');
      navigation.navigate('Login');
    });
  };


  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        <View style={styles.content}>
          <View style={styles.inputField}>
            <TextInput
              label="Enter Friends ID"
              mode="outlined"
              style={styles.textInput}
              onChangeText={(text) => setCallToUsername(text)}
              value={callToUsername}
              error={!!error}
            />
            {error ? (
              <Text style={styles.errorText}>
                {error}
              </Text>
            ) : null}
            <Text style={styles.statusText} children={`SOCKET ACTIVE: ${socketActive ? 'TRUE' : 'FALSE'}, FRIEND ID: ${otherId || callToUsername}`} />
            <Text style={[styles.statusText, { color: permissionsGranted ? '#4CAF50' : '#F44336', marginBottom: 10 }]} children={`PERMISSIONS: ${permissionsGranted ? 'GRANTED' : 'NOT GRANTED'}`} />
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={() => startCalling()}
                loading={calling}
                contentStyle={styles.btnContent}
                disabled={!socketActive || callToUsername === '' || callActive || !permissionsGranted}
                style={[styles.button, styles.callButton]}
                children="Call" />
              <Button
                mode="contained"
                onPress={handleHangUp}
                contentStyle={styles.btnContent}
                disabled={!callActive}
                style={[styles.button, styles.endCallButton]}
                children="End Call" />
            </View>
          </View>
          {/* available users containers */}
          <View style={styles.availableUsersContainer}>
            <Text style={styles.availableUsersText}>Available Users</Text>
            {availableUsers.length > 1 || availableUsers.length === 0 ? (
              <View style={styles.usersGrid}>
                {availableUsers
                  .filter(user => user !== userId) // Don't show current user
                  .map((userName, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => startCalling(userName)}
                      disabled={!socketActive || callActive || !permissionsGranted || calling}
                      style={styles.gridCardContainer}
                    >
                      <Card style={styles.userCard}>
                        <Card.Content style={styles.userCardContent}>
                          <Text style={styles.userName}>{userName}</Text>
                          <Button
                            mode="contained"
                            icon="phone"
                            onPress={() => startCalling(userName)}
                            disabled={!socketActive || callActive || !permissionsGranted || calling}
                            style={styles.callIcon}
                            compact
                          >
                            Call
                          </Button>
                        </Card.Content>
                      </Card>
                    </TouchableOpacity>
                  ))}
              </View>
            ) : (
              <Text style={[styles.statusText, { textAlign: 'center' }]}>
                No other users available
              </Text>
            )}
          </View>
          <View style={styles.videoContainer}>
            <View style={[styles.videos, styles.localVideos]}>
              <Text style={styles.videoLabel} children="Your Video" />
              {localPreviewStream ? (
                <RTCView
                  stream={localPreviewStream}
                  style={styles.localVideo}
                  objectfit="cover"
                />
              ) : (
                <View style={[styles.localVideo, styles.noVideoContainer]}>
                  <Text style={styles.noVideoText} children="No local video stream" />
                  <Text style={[styles.noVideoText, { fontSize: 12 }]} children={`Permissions: ${permissionsGranted ? 'Granted' : 'Not Granted'}`} />
                </View>
              )}
            </View>
            <View style={[styles.videos, styles.remoteVideos]}>
              <Text style={styles.videoLabel} children="Friends Video" />
              {remoteStream ? (
                <RTCView
                  stream={remoteStream}
                  style={styles.remoteVideo}
                  objectfit="cover"
                />
              ) : (
                <View style={[styles.remoteVideo, styles.noVideoContainer]}>
                  <Text style={styles.noVideoText} children="No remote video stream" />
                </View>
              )}
            </View>
          </View>

          {/* Web-specific content for better scrolling experience */}
          {Platform.OS === 'web' && (
            <View style={styles.webFooter}>
              <Text style={styles.footerText} children="WebRTC Video Call App" />
              <Text style={styles.footerSubtext} children="Built with React Native and Expo" />
            </View>
          )}
          {Platform.OS !== 'web' && (
            <View style={styles.webFooter}>
              <Text style={styles.footerText} children="WebRTC Video Call App" />
              <Text style={styles.footerSubtext} children="Built with React Native and Expo" />
            </View>
          )}
        </View>
      </ScrollView>



      {/* incoming call modal */}
      <Modal isVisible={incomingCall && !callActive}>
        <View style={styles.modalContent}>

          <Icon
            source="account-circle"
            size={104}
            color="#c4dcff"
          />

          <Text children={`${otherId} is calling you`} />

          <ActivityIndicator animating={true} color="#5166EC" size={50} style={styles.loadingIndicator} />

          <View style={styles.callContainer}>
            {/* <Button onPress={acceptCall} style={styles.finalCallButton} icon="phone" /> */}

            <TouchableOpacity
              onPress={acceptCall} style={styles.finalAcceptCallButton}
            >
              <Icon
                source="phone"
                size={54}
                color="#FFF"
              />
            </TouchableOpacity>

            {/* <Button onPress={handleHangUp} style={styles.finalHangupCallButton} icon="phone-hangup" /> */}

            <TouchableOpacity
              onPress={handleHangUp} style={styles.finalHangupCallButton}
            >
              <Icon
                source="phone-hangup"
                size={54}
                color="#FFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal isVisible={calling}>
        <View style={styles.modalContentCall}>

          <Icon
            source="account-circle"
            size={104}
            color="#c4dcff"
          />

          <Text children={`Calling ${otherId}...`} />

          <ActivityIndicator animating={true} color="#5166EC" size={50} style={styles.loadingIndicator} />

          {/* <Button onPress={handleHangUp} style={styles.finalHangupCallButton} icon="phone-hangup" /> */}
          <TouchableOpacity
            onPress={handleHangUp} style={styles.finalHangupCallButton}
          >
            <Icon
              source="phone-hangup"
              size={54}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#fff',
    height: Platform.OS === 'web' ? '100vh' : '100%',
    padding: Platform.OS === 'web' ? 20 : 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'web' ? 40 : 20,
  },
  content: {
    maxWidth: Platform.OS === 'web' ? 500 : '100%',
    alignSelf: Platform.OS === 'web' ? 'center' : 'stretch',
    width: '100%',
  },
  inputField: {
    marginBottom: Platform.OS === 'web' ? 30 : 20,
    flexDirection: 'column',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 400 : '100%',
    minWidth: Platform.OS === 'web' ? 100 : '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  videoContainer: {
    marginBottom: Platform.OS === 'web' ? 30 : 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videos: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    margin: Platform.OS === 'web' ? 10 : 10,

    minHeight: Platform.OS === 'web' ? 100 : 50,
    maxHeight: Platform.OS === 'web' ? 500 : 300,
    minWidth: Platform.OS === 'web' ? 100 : 50,
    maxWidth: Platform.OS === 'web' ? '100%' : '100%',
  },
  localVideos: {
    //height: Platform.OS === 'web' ? 400 : 350,
    //minHeight: Platform.OS === 'web' ? 300 : 50,
    //marginBottom: Platform.OS === 'web' ? 20 : 15,
  },
  remoteVideos: {
    //height: Platform.OS === 'web' ? 400 : 350,
    //minHeight: Platform.OS === 'web' ? 300 : 50,
  },
  localVideo: {
    backgroundColor: '#f8f9fa',
    height: '100%',
    width: '100%',
  },
  remoteVideo: {
    backgroundColor: '#f8f9fa',
    height: '100%',
    width: '100%',
  },
  btnContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: Platform.OS === 'web' ? 50 : 60,
    minWidth: Platform.OS === 'web' ? 100 : '100%',
    maxWidth: Platform.OS === 'web' ? 500 : '100%',
  },
  modalContent: {
    maxWidth: Platform.OS === 'web' ? 400 : '100%',
    backgroundColor: '#00132e',
    padding: 32,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalContentCall: {
    maxWidth: Platform.OS === 'web' ? 400 : '100%',
    backgroundColor: '#00132e',
    paddingVertical: 32,
    paddingHorizontal: 80,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  statusText: {
    marginBottom: 8,
    fontSize: Platform.OS === 'web' ? 14 : 12,
    color: '#666',
  },
  button: {
    marginBottom: 10,
    borderRadius: 8,
  },
  endCallButton: {
    backgroundColor: '#dc3545',
    flex: 1,
  },
  videoLabel: {
    margin: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  noVideoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  noVideoText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  webFooter: {
    marginTop: 40,
    marginBottom: 40,
    padding: 30,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  footerSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  callButton: {
    flex: 1,
    marginRight: 10,
  },
  textInput: {
    marginBottom: 10,
    width: '100%',
    flex: 1,
  },
  availableUsersContainer: {
    marginBottom: Platform.OS === 'web' ? 30 : 20,
    width: '100%',
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  availableUsersText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  userCard: {
    marginBottom: 10,
    //marginHorizontal: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    height: 120,
    //maxWidth: 120,
    backgroundColor: '#FFFDE7',
  },
  userCardContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    height: '100%',
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  callIcon: {
    marginTop: 4,
  },
  usersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    //width: '100%',
    //maxWidth: Platform.OS === 'web' ? 600 : '100%',
    alignSelf: 'center',
  },
  gridCardContainer: {
    width: 120,
    marginBottom: 10,
    marginHorizontal: 5,
  },
  callContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  finalAcceptCallButton: {
    backgroundColor: "#5166EC",
    padding: 10,
    borderRadius: 50,
    marginRight: 10,
    marginLeft: 10,
  },
  finalHangupCallButton: {
    backgroundColor: "#F44336",
    padding: 10,
    borderRadius: 50,
    marginRight: 10,
    marginLeft: 10,
  },
  loadingIndicator: {
    marginTop: 20,
    marginBottom: 20,
  },
}); 