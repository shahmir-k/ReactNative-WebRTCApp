import { useRef, useState, useEffect } from 'react';

import Constants from 'expo-constants';

const {
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



/**
 * Custom hook that handles all WebRTC operations including peer connection setup
 */
export const useWebRTC = () => {
    const peerConnectionRef = useRef(null); // Stores the current RTCPeerConnection instance

    // Media Stream State
    const [localVideoStream, setLocalVideoStream] = useState(null); // Local media stream state
    const [remoteVideoStream, setRemoteVideoStream] = useState(null); // Remote media stream state

    // Device selection state
    const [audioDevices, setAudioDevices] = useState([]); // Audio device list
    const [videoDevices, setVideoDevices] = useState([]); // Video device list
    const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(); // Selected Audio device
    const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState(); // Selected Video device 

    // Local stream state
    const [creatinglocalStreamLoading, setCreatingLocalStreamLoading] = useState(false);
    const [completeCreatingLocalStream, setCompleteCreatingLocalStream] = useState(false);

    // Offer state
    const [creatingOfferLoading, setCreatingOfferLoading] = useState(false);
    const [completeCreatingOffer, setCompleteCreatingOffer] = useState(false);

    // State of offer received from the peer
    const [acceptingOfferLoading, setAcceptingOfferLoading] = useState(false);
    const [completeAcceptingOffer, setCompleteAcceptingOffer] = useState(false);

    // Answer state
    const [creatingAnswerLoading, setCreatingAnswerLoading] = useState(false);
    const [completeCreatingAnswer, setCompleteCreatingAnswer] = useState(false);

    // State of the received answer from the peer
    const [acceptingAnswerLoading, setAcceptingAnswerLoading] = useState(false);
    const [completeAcceptingAnswer, setCompleteAcceptingAnswer] = useState(false);

    // ICE Candidate State
    const [iceCandidate, setIceCandidate] = useState(null);
    const [gatheringIceCandidateLoading, setGatheringIceCandidateLoading] = useState(false);
    const [completeIceCandidateExchange, setCompleteIceCandidateExchange] = useState(false);



    /**
     * Initialize the WebRTC peer connection once on component mount
     */
    useEffect(function init() {
        const peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: STUN_SERVER_URL || 'stun:stun.l.google.com:19302' }] // Configure ICE server for NAT traversal
        });

        // Handle remote media stream when received from peer
        peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            setRemoteVideoStream(remoteStream);
        };

        // ICE candidates are gathered after setting the local SDP (offer/answer)
        peerConnection.onicecandidate = (event) => {
            setGatheringIceCandidateLoading(true);

            if (event.candidate) {
                setIceCandidate(event.candidate); // Triggered each time a new ICE candidate is found
            }
        };

        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
                console.log(peerConnection.iceConnectionState)
                setGatheringIceCandidateLoading(false);
                setCompleteIceCandidateExchange(true);
            }
        };

        peerConnectionRef.current = peerConnection;

        // Clean up when the component unmounts
        return () => {
            peerConnection.close();
        };
    }, []);



    /**
     * handles starting the process of setting up the local media stream (camera and microphone).
     * - Sets loading state to true to indicate the setup is in progress
     * - Calls the async function `setUpLocalStream()` to acquire and attach local media tracks
     */
    const startCreatingLocalStream = () => {
        setCreatingLocalStreamLoading(true);
        setUpLocalStream();
    }

    /**
    * Acquires the user's local media stream (video and audio)
    */
    const setUpLocalStream = async () => {
        const constraints = {
            audio: {
                echoCancellation: false,        // Disable echo cancellation
                noiseSuppression: false,        // Disable noise suppression
                autoGainControl: false,         // Disable auto gain
                sampleRate: 48000,              // Audio sample rate
                channelCount: 2,                // Stereo audio
            },
            video: {
                width: 1280,
                height: 720,
                frameRate: { ideal: 60, max: 120 },
            },
        };

        const localStream = await mediaDevices.getUserMedia(constraints);  // Request access to user's camera and microphone based on the above constraints
        setLocalVideoStream(localStream); // Save the local media stream to state for video rendering

        // Add each media track (audio/video) to the RTCPeerConnection instance
        // This is required to send your own media (camera and microphone) to the remote peer
        localStream.getTracks().forEach(track => {
            peerConnectionRef.current?.addTrack(track, localStream);
        });

        setCreatingLocalStreamLoading(false);
        setCompleteCreatingLocalStream(true);

        // Get all available media input/output devices
        const allDevices = await mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter(device => device.kind === 'audioinput' && device.deviceId !== 'default');
        const videoInputs = allDevices.filter(device => device.kind === 'videoinput');

        // Set state with available devices and currently active device IDs
        setAudioDevices(audioInputs);
        setVideoDevices(videoInputs);

        const audioTracks = localStream.getAudioTracks();
        const videoTracks = localStream.getVideoTracks();

        // Set state with currently active device IDs
        setSelectedAudioDeviceId(audioTracks[0].getSettings().deviceId);
        setSelectedVideoDeviceId(videoTracks[0].getSettings().deviceId);
    };

    /**
     * Clean up local media tracks when component unmounts
     */
    useEffect(function cleanUp() {
        return () => {
            if (localVideoStream) {
                localVideoStream.getTracks().forEach(track => track.stop());
            }
        }
    }, [localVideoStream])



    /**
     * Handles switching the active audio and video input devices during an ongoing session.
     */
    const switchDevices = async (audioDeviceId, videoDeviceId) => {
        // Stop all existing local media tracks before switching
        if (localVideoStream) {
            localVideoStream.getTracks().forEach(track => track.stop());
        }

        // Build media constraints using selected device IDs
        const constraints = {
            audio: audioDeviceId ? {
                deviceId: { exact: audioDeviceId },
                echoCancellation: false,        // Disable echo cancellation
                noiseSuppression: false,        // Disable noise suppression
                autoGainControl: false,         // Disable auto gain
                sampleRate: 48000,              // Audio sample rate
                channelCount: 2,                // Stereo audio
            } : true,
            video: videoDeviceId
                ? {
                    deviceId: { exact: videoDeviceId },
                    width: 1280,
                    height: 720,
                    frameRate: { ideal: 60, max: 120 },
                }
                : true,
        };

        const localStream = await mediaDevices.getUserMedia(constraints); // Request a new media stream with the selected devices
        setLocalVideoStream(localStream); // Save the new local stream to state for rendering

        // Replace each track in the peer connection with the new one
        localStream.getTracks().forEach((track) => {
            const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === track.kind);
            sender?.replaceTrack(track);
        });

        // Update the selected device IDs in state
        setSelectedAudioDeviceId(audioDeviceId);
        setSelectedVideoDeviceId(videoDeviceId);
    };



    /**
     * handles starting the process of creating an SDP offer to start a peer connection
     * - Sets loading state to indicate the offer creation process is in progress
     * - Calls the async `createOffer()` to generate and set the local description
     */
    const startCreatingOffer = (handleSetOffer) => {
        setCreatingOfferLoading(true);
        createOffer(handleSetOffer);
    };

    /**
     * Creates an SDP offer and sets it as the local description of the peer connection
     */
    const createOffer = async (handleSetOffer) => {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);

        setCreatingOfferLoading(false);
        setCompleteCreatingOffer(true);
        handleSetOffer(offer);
    };



    /**
     * handles starting the process of accepting an SDP offer received from a remote peer
     * - Sets loading state to indicate accepting offer process is in progress
     * - Calls the async `setRemoteOffer()` to set SDP offer received from a remote peer
     */
    const startAcceptingOffer = (offer) => {
        setAcceptingOfferLoading(true);
        setRemoteOffer(offer);
    };

    /**
     * Sets the received SDP offer as the remote description of the peer connection
     */
    const setRemoteOffer = async (offer) => {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));

        setAcceptingOfferLoading(false);
        setCompleteAcceptingOffer(true);
    };



    /**
     * handles starting the process of creating an SDP answer in response to a received offer
     * - Sets loading state to indicate the answer creation process is in progress
     * - Calls async `createAnswer()` to generate and set the local description
     */
    const startCreatingAnswer = (handleSetAnswer) => {
        setCreatingAnswerLoading(true);
        createAnswer(handleSetAnswer);
    };

    /**
     * Creates an SDP answer and sets it as the local description of the peer connection.
     */
    const createAnswer = async (handleSetAnswer) => {
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        setCreatingAnswerLoading(false);
        setCompleteCreatingAnswer(true);
        handleSetAnswer(answer);
    };



    /**
     * hanldes stating the process of accepting an SDP answer received from the remote peer
     * - Sets loading state to indicate accepting answer is in progress
     * - Calls the async `setRemoteAnswer()` to set SDP answer received from a remote peer
     */
    const startAcceptingAnswer = (answer) => {
        setAcceptingAnswerLoading(true);
        setRemoteAnswer(answer);
    };

    /**
     * Sets the received SDP answer as the remote description of the peer connection.
     */
    const setRemoteAnswer = async (answer) => {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));

        setAcceptingAnswerLoading(false);
        setCompleteAcceptingAnswer(true);
    };



    /**
     * Handles adding a received ICE candidate from the remote peer to the peer connection.
     */
    const addIceCandidate = async (candidate) => {
        await peerConnectionRef.current.addIceCandidate(candidate);
    };



    return {
        localVideoStream,
        remoteVideoStream,

        audioDevices,
        videoDevices,
        selectedAudioDeviceId,
        selectedVideoDeviceId,
        switchDevices,

        startCreatingLocalStream,
        creatinglocalStreamLoading,
        completeCreatingLocalStream,

        startCreatingOffer,
        creatingOfferLoading,
        completeCreatingOffer,

        startAcceptingOffer,
        acceptingOfferLoading,
        completeAcceptingOffer,

        startCreatingAnswer,
        creatingAnswerLoading,
        completeCreatingAnswer,

        startAcceptingAnswer,
        acceptingAnswerLoading,
        completeAcceptingAnswer,

        gatheringIceCandidateLoading,
        iceCandidate,
        completeIceCandidateExchange,
        addIceCandidate,
    };
}