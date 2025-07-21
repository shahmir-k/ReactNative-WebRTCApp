// import { Text, View } from 'react-native'
import React, { Component, useEffect, useState, useCallback, useRef, use } from 'react';
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

    const microphoneEnabledRef = useRef(microphoneEnabled);
    const cameraEnabledRef = useRef(cameraEnabled);


    for (let i = 0; i < otherCallNum; i++) {
        otherCallerStreams.push(
            <View key={i} style={[
                styles.callVideos,
                styles.callLocalVideos,
                otherCallNum >= 2 ?
                    { width: highUserVideoWidth, height: highUserVideoHeight }
                    : { width: lowUserVideoWidth, height: lowUserVideoHeight }
            ]}>
                <View style={styles.callNameText}>
                    <Text style={styles.callVideoLabel} children={otherId + ` ${i + 1}`} />
                </View>
                {remoteStream ? (
                    <RTCView
                        stream={remoteStream}
                        style={styles.callRemoteVideo}
                        objectfit="cover"
                    />
                ) : (
                    <View style={[styles.callRemoteVideo, styles.callNoVideoContainer]}>
                        <Text style={styles.callNoVideoText} children="No remote video stream" />
                    </View>
                )}
            </View>
        );
    }


    // useEffect(() => {
    //     if (callActive) {
    //         const sender = yourConn.current?.getSenders().forEach(sender => {
    //             if (sender.track.kind == 'audio') {
    //                 sender.track.enabled = microphoneEnabled;
    //                 console.log(`Audio track checked here: ${sender.track.kind} (${sender.track.id})`);
    //             }
    //         });
    //     }
    // }, [microphoneEnabled]);

    // useEffect(() => {
    //     if (callActive) {
    //         const sender = yourConn.current?.getSenders().forEach(sender => {
    //             if (sender.track.kind == 'video') {
    //                 sender.track.enabled = cameraEnabled;
    //                 console.log(`Video track checked here: ${sender.track.kind} (${sender.track.id})`);
    //             }
    //         });
    //     }
    // }, [cameraEnabled])

    useEffect(() => {
        if (!callActive) {
            navigation.goBack();
        }
    }, [callActive])

    return (
        <View style={styles.callVideoContainer}>

            {/* <Text style={{ color: '#FFF', fontSize: 20, marginBottom: 10 }} children={'Callers: ' + (otherCallNum + 1)} /> */}

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <View style={[
                    styles.callVideos,
                    styles.callLocalVideos,
                    otherCallNum >= 2 ?
                        { width: highUserVideoWidth, height: highUserVideoHeight }
                        : { width: lowUserVideoWidth, height: lowUserVideoHeight }
                ]}>

                    <View style={styles.callNameText}>
                        <Text style={styles.callVideoLabel} children={userId} />
                    </View>

                    <View
                        style={microphoneEnabled ? styles.callMicStatusUnmuted : styles.callMicStatusMuted}
                    >
                        {microphoneEnabled ? (
                            <IconButton
                                icon="microphone"
                                size={22}
                                color="#FFF"
                                style={{ position: 'static' }}
                            />
                        ) : (
                            <IconButton
                                icon="microphone-off"
                                size={22}
                                color="#FFF"
                                style={{ position: 'static' }}
                            />
                        )}
                    </View>

                    <View
                        style={cameraEnabled ? styles.callCameraStatusOn : styles.callCameraStatusOff}
                    >
                        {cameraEnabled ? (
                            <IconButton
                                icon="camera"
                                size={22}
                                color="#FFF"
                                style={{ position: 'static' }}
                            />
                        ) : (
                            <IconButton
                                icon="camera-off"
                                size={22}
                                color="#FFF"
                                style={{ position: 'static' }}
                            />
                        )}
                    </View>

                    {localPreviewStream ? (
                        <RTCView
                            stream={localPreviewStream}
                            style={styles.callLocalVideo}
                            objectfit="cover"
                        />
                    ) : (
                        <View style={[styles.callLocalVideo, styles.callNoVideoContainer]}>
                            <Text style={styles.callNoVideoText} children="No local video stream" />
                            <Text style={[styles.callNoVideoText, { fontSize: 12 }]} children={`Permissions: ${permissionsGranted ? 'Granted' : 'Not Granted'}`} />
                        </View>
                    )}

                </View>

                <View>

                </View>

                {/* <View style={[styles.callVideos, styles.callRemoteVideos]}>

                    <View style={styles.callNameText}>
                        <Text style={styles.callVideoLabel} children={otherId} />
                    </View>

                    {remoteStream ? (
                        <RTCView
                            stream={remoteStream}
                            style={styles.callRemoteVideo}
                            objectfit="cover"
                        />
                    ) : (
                        <View style={[styles.callRemoteVideo, styles.callNoVideoContainer]}>
                            <Text style={styles.callNoVideoText} children="No remote video stream" />
                        </View>
                    )}

                </View> */}

                {otherCallerStreams}

            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>

                <Button
                    onPress={() => {
                        setMicrophoneEnabled(!microphoneEnabled);
                        microphoneEnabledRef.current = !microphoneEnabled;

                        if (callActive) {
                            const sender = yourConn.current?.getSenders().forEach(sender => {
                                if (sender.track != null && sender.track.kind == 'audio') {
                                    sender.track.enabled = microphoneEnabledRef.current;
                                    console.log(`Audio track checked here: ${sender.track.kind} (${sender.track.id})`);
                                    console.log(sender.track);
                                    console.log(remoteStreamRef.current.getAudioTracks());
                                }
                            });
                        }
                    }}

                    style={microphoneEnabled ? styles.callMuteButtonUnmuted : styles.callMuteButtonMuted}
                >
                    {microphoneEnabled ? (
                        <Icon
                            source="microphone"
                            size={30}
                            style={{ padding: 20 }}
                        />
                    ) : (
                        <Icon
                            source="microphone-off"
                            size={30}
                            style={{ padding: 20 }}
                        />
                    )
                    }

                    {/* <Text children="Microphone" /> */}
                </Button>

                <Button
                    onPress={() => {
                        setCameraEnabled(!cameraEnabled);
                        cameraEnabledRef.current = !cameraEnabled;

                        if (callActive) {
                            const sender = yourConn.current?.getSenders().forEach(sender => {
                                if (sender.track != null && sender.track.kind == 'video') {
                                    sender.track.enabled = cameraEnabledRef.current;
                                    console.log(`Video track checked here: ${sender.track.kind} (${sender.track.id})`);
                                }
                            });
                        }
                    }}

                    style={cameraEnabled ? styles.callCameraButtonOn : styles.callCameraButtonOff}
                >
                    {cameraEnabled ? (
                        <Icon
                            source="video"
                            size={30}
                            style={{ padding: 20 }}
                        />
                    ) : (
                        <Icon
                            source="video-off"
                            size={30}
                            style={{ padding: 20 }}
                        />
                    )}
                </Button>

                <Button
                    style={styles.callAddContactsButton}
                >
                    <Icon
                        source="account-multiple-plus"
                        size={30}
                        style={{ padding: 20 }}
                    />
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
                        // navigation.goBack();
                    }}

                    style={styles.callHangupButton}
                >
                    <Icon
                        source="phone-hangup"
                        size={30}
                        style={{ padding: 20 }}
                    />
                </Button>

            </View>

            {/* <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
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
            </View> */}


        </View>
    )
}

const styles = StyleSheet.create({
    callVideoContainer: {
        flex: 1,
        padding: 10,
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
    },
    callVideos: {
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
    callLocalVideos: {
        position: 'relative',
        // height: Platform.OS === 'web' ? 400 : 350,
        // minHeight: Platform.OS === 'web' ? 300 : 50,
        marginBottom: Platform.OS === 'web' ? 20 : 15,
        // width: highUserVideoWidth,
        // height: highUserVideoHeight,
    },
    callRemoteVideos: {
        position: 'relative',
        // minHeight: Platform.OS === 'web' ? 300 : 50,
        marginBottom: Platform.OS === 'web' ? 20 : 15,
        // width: highUserVideoWidth,
        // height: highUserVideoHeight,
    },
    callLocalVideo: {
        // backgroundColor: '#f8f9fa',
        height: '100%',
        width: '100%',
        borderRadius: 12,
    },
    callRemoteVideo: {
        // backgroundColor: '#f8f9fa',
        height: '100%',
        width: '100%',
        borderRadius: 12,
    },
    callVideoLabel: {
        margin: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
    callNameText: {
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 1,
        backgroundColor: '#5166EC',
        padding: 4,
        borderRadius: 8,
        opacity: 0.8,
    },
    callMicStatusUnmuted: {
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1,
        backgroundColor: '#525252ff',
        padding: 4,
        borderRadius: 8,
        opacity: 0.8,
    },
    callMicStatusMuted: {
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1,
        backgroundColor: '#FF3B30',
        padding: 4,
        borderRadius: 8,
        opacity: 1,
    },

    callCameraStatusOn: {
        position: 'absolute',
        top: 10,
        right: 75,
        zIndex: 1,
        backgroundColor: '#525252ff',
        padding: 4,
        borderRadius: 8,
        opacity: 0.8,
    },

    callCameraStatusOff: {
        position: 'absolute',
        top: 10,
        right: 75,
        zIndex: 1,
        backgroundColor: '#FF3B30',
        padding: 4,
        borderRadius: 8,
        opacity: 1,
    },

    callNoVideoContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    callNoVideoText: {
        color: '#888',
    },

    callMuteButtonUnmuted: {
        backgroundColor: '#525252ff',
        borderRadius: 100,
        // padding: 10,
        marginHorizontal: 10,
    },

    callMuteButtonMuted: {
        backgroundColor: '#FF3B30',
        borderRadius: 100,
        // padding: 10,
        marginHorizontal: 10,
    },

    callCameraButtonOn: {
        backgroundColor: '#525252ff',
        borderRadius: 100,
        // padding: 10,
        marginHorizontal: 5,
    },

    callCameraButtonOff: {
        backgroundColor: '#FF3B30',
        borderRadius: 100,
        // padding: 10,
        marginHorizontal: 5,
    },

    callHangupButton: {
        backgroundColor: '#FF3B30',
        borderRadius: 100,
        // padding: 10,
        marginHorizontal: 10,
    },

    callAddContactsButton: {
        backgroundColor: '#5166EC',
        borderRadius: 100,
        // padding: 10,
        marginHorizontal: 10,
    },
});

export default CallStart;