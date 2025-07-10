import React, { createContext, useContext, useRef, useState, useEffect, useCallback, } from 'react';
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
import { Platform } from 'react-native';

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

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {

    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [localPreviewStream, setLocalPreviewStream] = useState(null);
    const [callActive, setCallActive] = useState(false);
    const [calling, setCalling] = useState(false);
    const [incomingCall, setIncomingCall] = useState(false);
    const [otherId, setOtherId] = useState('');
    const [userId, setUserId] = useState('');
    const [error, setError] = useState('');

    const userIdRef = useRef('');
    const connectedUser = useRef(null);
    const callActiveRef = useRef(false);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const offerRef = useRef(null);

    const yourConn = useRef(
        new RTCPeerConnection({
            iceServers: ICE_SERVERS, // Use the enhanced ICE server configuration
            iceCandidatePoolSize: parseInt(ICE_CANDIDATE_POOL_SIZE), // Pre-gather more ICE candidates for faster connection establishment
            bundlePolicy: BUNDLE_POLICY, // Bundle all media streams for efficiency
            rtcpMuxPolicy: RTCP_MUX_POLICY, // Require RTCP multiplexing for better compatibility
            iceTransportPolicy: ICE_TRANSPORT_POLICY, // Allow all types of ICE candidates (host, srflx, relay)
        })
    );

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

    return (
        <CallContext.Provider value={{
            localStream, setLocalStream,
            remoteStream, setRemoteStream,
            localPreviewStream, setLocalPreviewStream,
            callActive, setCallActive,
            calling, setCalling,
            incomingCall, setIncomingCall,
            otherId, setOtherId,
            userId, setUserId,
            error, setError,

            userIdRef,
            connectedUser,
            callActiveRef,
            localStreamRef,
            remoteStreamRef,
            offerRef,


        }}>
            {children}
        </CallContext.Provider>
    );
};