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

  registerGlobals, //not used, for all platforms
  MediaStream, //not used, for all platforms
  MediaStreamTrack, //not used, for all platforms
  RTCRtpTransceiver, //not used, web only
  RTCRtpReceiver, //not used, web only
  RTCRtpSender, //not used, web only
  RTCErrorEvent, //not used, web only
  permissions, //not used, web only
} from 'react-native-webrtc-web-shim';

import { requestAllPermissions } from '../utils/permissions';

// TODO: add these to .env file
const STUN_SERVER = 'stun:stun.l.google.com:19302';
const TURN_SERVER = 'turn:openrelay.metered.ca:80';
const TURN_USERNAME = 'openrelayproject';
const TURN_CREDENTIAL = 'openrelayproject';
const SOCKET_URL = 'ws://192.168.0.132:9090/signal';

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
      iceServers: [
        {
          urls: STUN_SERVER,
        },
        {
          urls: TURN_SERVER,
          username: TURN_USERNAME,
          credential: TURN_CREDENTIAL,
        },
      ],
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
      if(Platform.OS === 'web') {
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
      conn.current = new WebSocket(SOCKET_URL);
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
      console.log('On Add Remote Stream');
      setRemoteStream(event.stream);
    };

    // Handle remote track addition (modern method, especially for web)
    yourConn.current.ontrack = (event) => {
      console.log('On Track Event', event);
      if (event.track && event.track.kind === 'video') {
        console.log('On Add Remote Stream (Web)');
        setRemoteStream(event.streams[0]);
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
  };

  /**
   * Reset WebRTC peer connection
   * Creates new peer connection and registers event handlers
   */
  const resetPeer = () => {
    console.log('🔄 resetPeer called');
    yourConn.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: STUN_SERVER,
        },
        {
          urls: TURN_SERVER,
          username: TURN_USERNAME,
          credential: TURN_CREDENTIAL,
        },
      ],
    });
    console.log('🆕 New RTCPeerConnection created and assigned to yourConn.current');
    registerPeerEvents();
    console.log('🔗 Peer events registered');

    console.log('🔐 permissionsGranted (state):', permissionsGranted, '| (ref):', permissionsGrantedRef.current);
    
    console.log('🎥 Calling checkPermissionsAndInitVideo from resetPeer');
    checkPermissionsAndInitVideo();
    
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
    console.log('initLocalVideo called, permissionsGranted (state):', permissionsGranted, '| (ref):', permissionsGrantedRef.current);
    
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
        setLocalStream(stream);
        stream.getTracks().forEach(track => {
          console.log('Adding track to peer connection:', track.kind);
          yourConn.current.addTrack(track, stream);
        });
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
    if(user === '') {
      setError('Please enter a valid user ID');
      return;
    }
    if(user === userIdRef.current) {
      setError('You cannot call yourself');
      return;
    }
    if(user === connectedUser.current) {
      setError('You are already calling this user');
      return;
    }
    if(callActive) {
      setError('You are already in a call');
      return;
    }
    if(!socketActive) {
      setError('WebSocket is not active');
      return;
    }
    
    setError('');
    const granted = await checkPermissionsAndInitVideo();
    if (granted) {
      sendCallOffer(user);
      setTimeout(() => {
        if(!callActiveRef.current) {
          console.log('Call is not active, sending offer again');
          sendCallOffer(user);
        }
      }, 3000);
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
    offerRef.current = {name, offer};
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
    yourConn.current.setRemoteDescription(new RTCSessionDescription(answer));
  };

  /**
   * Handle incoming ICE candidate
   * @param candidate - The ICE candidate object
   */
  const handleCandidate = (candidate) => {
    setCalling(false);
    yourConn.current.addIceCandidate(new RTCIceCandidate(candidate));
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
    yourConn.current.onicecandidate = null;
    yourConn.current.onaddstream = null;
    yourConn.current.ontrack = null;

    resetPeer();
    
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
    console.log('🚪 onLogout called');
    handleHangUp();
    //handleLogout();
    
    // Close WebSocket connection if it exists
    // conn.current holds our WebSocket connection to the signaling server
    // that handles call setup and peer coordination
    // The ? is the optional chaining operator - it only calls close() 
    // if conn.current exists, preventing errors if the connection is null
    conn.current?.close();
    AsyncStorage.removeItem('userId').then((res) => {
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
            <Text style={[styles.statusText, {color: permissionsGranted ? '#4CAF50' : '#F44336', marginBottom: 10}]} children={`PERMISSIONS: ${permissionsGranted ? 'GRANTED' : 'NOT GRANTED'}`} />
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
              <Text style={[styles.statusText, {textAlign: 'center'}]}>
                No other users available
              </Text>
            )}
          </View>
          <View style={styles.videoContainer}>
            <View style={[styles.videos, styles.localVideos]}>
              <Text style={styles.videoLabel} children="Your Video" />
              {localStream ? (
                <RTCView
                  stream={localStream}
                  style={styles.localVideo}
                  objectfit="cover"
                />
              ) : (
                <View style={[styles.localVideo, styles.noVideoContainer]}>
                  <Text style={styles.noVideoText} children="No local video stream" />
                  <Text style={[styles.noVideoText, {fontSize: 12}]} children={`Permissions: ${permissionsGranted ? 'Granted' : 'Not Granted'}`} />
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
          <Text children={`${otherId} is calling you`} />
          <Button onPress={acceptCall} style={{marginTop: 10}} children="Accept Call" />
          <Button onPress={handleHangUp} style={{marginTop: 10}} children="Reject Call" />
        </View>
      </Modal>
      <Modal isVisible={calling}>
        <View style={styles.modalContent}>
          <Text children={`Calling ${otherId}...`} />
          <Button onPress={handleHangUp} style={{marginTop: 10}} children="Cancel Call" />
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
    backgroundColor: 'white',
    padding: 22,
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
}); 