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

    return (
        <View>

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


        </View>
    )
}

const styles = StyleSheet.create({
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
        height: Platform.OS === 'web' ? 400 : 350,
        minHeight: Platform.OS === 'web' ? 300 : 50,
        marginBottom: Platform.OS === 'web' ? 20 : 15,
    },
    remoteVideos: {
        height: Platform.OS === 'web' ? 400 : 350,
        minHeight: Platform.OS === 'web' ? 300 : 50,
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
        color: '#888',
    },
});

export default CallStart;