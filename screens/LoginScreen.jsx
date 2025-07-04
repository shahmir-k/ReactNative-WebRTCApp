// Shahmir Khan June 23, 2025
// Github: https://github.com/shahmir-k
// LinkedIn: https://www.linkedin.com/in/shahmir-k

import React, {useState, useRef} from 'react';
import {View, StyleSheet, Dimensions, Platform} from 'react-native';
import {Text, TextInput, Button} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get environment variables from Expo config
const SIGNALING_SERVER_URL = Constants.expoConfig?.extra?.SIGNALING_SERVER_URL;

export default function LoginScreen({navigation}) {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wsRef = useRef(null);

  const onLogin = async () => {
    if (!userId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create WebSocket connection using environment variable
      console.log('SIGNALING_SERVER_URL:', SIGNALING_SERVER_URL);
      const ws = new WebSocket(SIGNALING_SERVER_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔗 Connected to signaling server for login');
        // Send join request
        ws.send(JSON.stringify({
          type: 'join',
          sender: userId,
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 Received login response:', data);
        
        if (data.type === 'join') {
          if (data.data && data.data.result === true) {
            // Join successful, save user ID and navigate
            // Don't close the WebSocket - let CallScreen reuse it
            AsyncStorage.setItem('userId', userId).then(() => {
              setLoading(false);
              // Store the WebSocket connection for CallScreen to use
              global.loginWebSocket = ws;
              navigation.navigate('Call');
            });
          } else {
            // Join failed (user ID already taken)
            setError('User ID already taken. Please choose another one.');
            setLoading(false);
            ws.close();
          }
        }
      };

      ws.onerror = (error) => {
        console.log('❌ WebSocket error during login:', error);
        setError('Failed to connect to server. Please try again.');
        setLoading(false);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket closed during login');
        if (loading) {
          setError('Connection lost. Please try again.');
          setLoading(false);
        }
      };

    } catch (err) {
      console.log('Error during login:', err);
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };


  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.heading}>
          React-Native WebRTC Video Chat{'\n\n'}Enter your ID
        </Text>
        <TextInput
          label="Your ID"
          placeholder="Enter your user ID"
          autoFocus={true}
          onChangeText={setUserId}
          mode="outlined"
          style={styles.input}
          value={userId}
          error={!!error}
          onSubmitEditing={onLogin}
        />

        {error ? (
          <Text style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        <Button
          mode="contained"
          onPress={onLogin}
          loading={loading}
          style={styles.btn}
          contentStyle={styles.btnContent}
          disabled={userId.length === 0 || loading}
        >
          {loading ? "Connecting..." : "Login"}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 400 : '100%',
    alignSelf: 'center',
  },
  heading: {
    fontSize: 18,
    marginBottom: 10,
    fontWeight: '600',
    textAlign: 'center',
    color: 'black',
  },
  input: {
    height: 60,
    marginBottom: 20,
  },
  btn: {
    height: 60,
    alignItems: 'stretch',
    justifyContent: 'center',
    fontSize: 18,
  },
  btnContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
}); 