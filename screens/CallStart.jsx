import { Text, View } from 'react-native'
import React, { Component } from 'react'
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



const CallStart = ({ navigation, route }) => {

    const { localPreviewStream, remoteStream } = route.params;

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


        </View>
    )
}

export default CallStart;