// import { Text, View } from 'react-native'
import React, { Component, useEffect, useState, useCallback, useRef } from 'react';
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

import { useCall } from '../contexts/CallContext';

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

const highUserVideoWidth = Platform.OS === 'web' ? 550 : 320;
const highUserVideoHeight = Platform.OS === 'web' ? '100' : '100';

const lowUserVideoWidth = Platform.OS === 'web' ? 850 : 160;
const lowUserVideoHeight = Platform.OS === 'web' ? '100' : '100';

const CallStart = ({ navigation, route }) => {

    const {
        userId, setUserId,
        socketActive, setSocketActive,
        calling, setCalling,
        localStream, setLocalStream,
        remoteStream, setRemoteStream,
        permissionsGranted, setPermissionsGranted,
        permissionsGrantedRef,
        error, setError,

        conn,
        yourConn,

        callActive, setCallActive,
        incomingCall, setIncomingCall,
        otherId, setOtherId,
        callToUsername, setCallToUsername,
        availableUsers, setAvailableUsers,
        connectedUser,
        offerRef,
        userIdRef,
        callActiveRef,

        iceCandidateQueue,
        remoteDescriptionSet,
        localStreamRef,
        remoteStreamRef,

        localPreviewStream, setLocalPreviewStream,

        checkPermissionsAndInitVideo,
        registerPeerEvents,
        resetPeer,
        fetchAvailableUsers,
        initLocalVideo,
        send,
        startCalling,
        sendCallOffer,
        handleOffer,
        acceptCall,
        handleAnswer,
        handleCandidate,
        checkAllMediaActive,
        stopAllMediaGlobally,
        forceStopAllMedia,
        cleanupAllMedia,
        handleHangUp,
        handleLogout,

    } = useCall();

    const [otherCallNum, setOtherCallNum] = useState(1);

    const otherCallerStreams = [];

    const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);

    for (let i = 0; i < otherCallNum; i++) {
        otherCallerStreams.push(
            <View key={i} style={[
                styles.videos,
                styles.localVideos,
                otherCallNum >= 2 ?
                    { width: highUserVideoWidth, height: highUserVideoHeight }
                    : { width: lowUserVideoWidth, height: lowUserVideoHeight }
            ]}>
                <View style={styles.nameText}>
                    <Text style={styles.videoLabel} children={otherId + ` ${i + 1}`} />
                </View>
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
        );
    }

    useEffect(() => {
        const stream = localStreamRef.current || localStream;
        if (stream) {
            stream.getAudioTracks().forEach(track => {
                track.enabled = microphoneEnabled;
            });
        }
    }, [microphoneEnabled, localStream, localStreamRef, callActive]);

    return (
        <View style={styles.videoContainer}>

            {/* <Text style={{ color: '#FFF', fontSize: 20, marginBottom: 10 }} children={'Callers: ' + (otherCallNum + 1)} /> */}

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <View style={[
                    styles.videos,
                    styles.localVideos,
                    otherCallNum >= 2 ?
                        { width: highUserVideoWidth, height: highUserVideoHeight }
                        : { width: lowUserVideoWidth, height: lowUserVideoHeight }
                ]}>

                    <View style={styles.nameText}>
                        <Text style={styles.videoLabel} children={userId} />
                    </View>

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

                {/* <View style={[styles.videos, styles.remoteVideos]}>

                    <View style={styles.nameText}>
                        <Text style={styles.videoLabel} children={otherId} />
                    </View>

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

                </View> */}

                {otherCallerStreams}

            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>

                <Button
                    onPress={() => {
                        setMicrophoneEnabled((prev) => !prev);
                    }}

                    style={microphoneEnabled ? styles.muteButtonUnmuted : styles.muteButtonMuted}
                >
                    {microphoneEnabled ? (
                        <Icon
                            source="microphone"
                            style={{ width: 50, height: 100 }}
                        />
                    ) : (
                        <Icon
                            source="microphone-off"
                            style={{ width: 50, height: 100 }}
                        />
                    )
                    }

                    {/* <Text children="Microphone" /> */}
                </Button>

                <Button
                    onPress={() => {
                        setCameraEnabled((prev) => !prev);
                        if (localStreamRef.current) {
                            localStreamRef.current.getVideoTracks().forEach(track => {
                                track.enabled = !cameraEnabled;
                            });
                        }
                    }
                    }
                >
                    {cameraEnabled ? (
                        <Icon
                            source="video"
                            style={{ width: 50, height: 100 }}
                            onPress={() => {
                                setCameraEnabled(false);
                                localStreamRef.current.getVideoTracks().forEach(track => {
                                    track.enabled = false;
                                });
                            }}
                        />
                    ) : (
                        <Icon
                            source="video-off"
                            style={{ width: 50, height: 100 }}
                            onPress={() => {
                                setCameraEnabled(true);
                                localStreamRef.current.getVideoTracks().forEach(track => {
                                    track.enabled = true;
                                });
                            }}
                        />
                    )}
                </Button>

                <Button
                    mode="contained"
                    onPress={() => {
                        // Alert.alert("Call Ended", "You have ended the call.");
                        // send({
                        //     type: 'hangUp',
                        //     sender: userIdRef.current,
                        //     receiver: connectedUserId.current,
                        // });
                        handleHangUp();
                        navigation.goBack();
                    }}
                >
                    <Text children="End Call" />
                </Button>

                <Button>
                    <Text children="Add Another Caller" />
                </Button>

            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <Button
                    mode="contained"
                    onPress={() => {
                        setOtherCallNum(otherCallNum - 1);
                    }}
                >
                    <Text children="Remove -" />
                </Button>

                <Button
                    mode="contained"
                    onPress={() => {
                        setOtherCallNum(otherCallNum + 1);
                    }}
                >
                    <Text children="Add +" />
                </Button>
            </View>


        </View>
    )
}

const styles = StyleSheet.create({
    videoContainer: {
        flex: 1,
        padding: 10,
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videos: {
        // width: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
        // backgroundColor: '#f8f9fa',
        // borderWidth: 1,
        // borderColor: '#e9ecef',
        margin: 15,

        // width: highUserVideoWidth,
        // height: highUserVideoHeight,

        // minHeight: Platform.OS === 'web' ? 100 : 50,
        // maxHeight: Platform.OS === 'web' ? 500 : 300,
        // minWidth: Platform.OS === 'web' ? 100 : 50,
        // maxWidth: Platform.OS === 'web' ? '100%' : '100%',
    },
    localVideos: {
        position: 'relative',
        // height: Platform.OS === 'web' ? 400 : 350,
        // minHeight: Platform.OS === 'web' ? 300 : 50,
        marginBottom: Platform.OS === 'web' ? 20 : 15,
        // width: highUserVideoWidth,
        // height: highUserVideoHeight,
    },
    remoteVideos: {
        position: 'relative',
        // minHeight: Platform.OS === 'web' ? 300 : 50,
        marginBottom: Platform.OS === 'web' ? 20 : 15,
        // width: highUserVideoWidth,
        // height: highUserVideoHeight,
    },
    localVideo: {
        // backgroundColor: '#f8f9fa',
        height: '100%',
        width: '100%',
        borderRadius: 12,
    },
    remoteVideo: {
        // backgroundColor: '#f8f9fa',
        height: '100%',
        width: '100%',
        borderRadius: 12,
    },
    videoLabel: {
        margin: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
    nameText: {
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 1,
        backgroundColor: '#5166EC',
        padding: 4,
        borderRadius: 8,
        opacity: 0.8,
    },
    noVideoContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    noVideoText: {
        color: '#888',
    },

    muteButtonUnmuted: {
        backgroundColor: '#525252ff',
        borderRadius: 500,
    },

    muteButtonMuted: {
        backgroundColor: '#FF3B30',
        borderRadius: 500,
    },
});

export default CallStart;