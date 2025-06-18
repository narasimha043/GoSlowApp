import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  PermissionsAndroid,
  Text,
  Platform,
  Vibration,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from '@react-navigation/native';
import dgram from 'react-native-udp';
import geolib from 'geolib';
import Sound from 'react-native-sound';
import DeviceInfo from 'react-native-device-info';

const UDP_PORT = 41234;
const SPEED_LIMIT_ALERT = 30;
const SPEED_LIMIT_WARNING = 5;
const DISTANCE_LIMIT = 25;

Sound.setCategory('Playback');

const HomeScreen = () => {
  const mapRef = useRef(null);
  const navigation = useNavigation();
  const [origin, setOrigin] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [nearbyAlert, setNearbyAlert] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [targetIp, setTargetIp] = useState('');
  const [modalVisible, setModalVisible] = useState(true);

  const socketRef = useRef(null);
  const deviceIdRef = useRef('');
  const lastAlertTimeRef = useRef(0);
  const currentLocationRef = useRef(null);
  const alertSoundRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    deviceIdRef.current = DeviceInfo.getUniqueId();
    alertSoundRef.current = new Sound('alert.mp3', Sound.MAIN_BUNDLE, (error) => {
      if (error) {
        console.log('Sound load error:', error);
        alertSoundRef.current = null;
      } else {
        console.log('Sound loaded');
      }
    });

    return () => {
      if (alertSoundRef.current) {
        alertSoundRef.current.release();
      }
    };
  }, []);

  const playAlert = () => {
    Vibration.vibrate([500, 500, 500]);
    if (alertSoundRef.current) {
      alertSoundRef.current.stop(() => {
        alertSoundRef.current.play((success) => {
          if (!success) {
            console.log('Playback failed');
          } else {
            console.log('Alert sound played');
          }
        });
      });
    }
  };

  const startTracking = async () => {
    if (!targetIp) {
      console.warn('Target IP is empty');
      return;
    }

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Location permission denied');
        return;
      }
    }

    const socket = dgram.createSocket('udp4');
    socketRef.current = socket;

    socket.bind(UDP_PORT, undefined, () => {
      socket.setBroadcast(false);
      console.log('UDP socket bound');
    });

    socket.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.deviceId === deviceIdRef.current) {return;}

        if (currentLocationRef.current) {
          const distance = geolib.getDistance(currentLocationRef.current, {
            latitude: data.latitude,
            longitude: data.longitude,
          });

          console.log(`📡 Received: Speed=${data.speed}, Distance=${distance}m`);

          if (
            distance < DISTANCE_LIMIT &&
            (data.speed > SPEED_LIMIT_WARNING || speed > SPEED_LIMIT_WARNING)
          ) {
            const now = Date.now();
            if (now - lastAlertTimeRef.current > 10000) {
              lastAlertTimeRef.current = now;
              playAlert();
              setNearbyAlert(true);
              setTimeout(() => setNearbyAlert(false), 3000);
            }
          }
        }
      } catch (e) {
        console.log('UDP parse error:', e);
      }
    });

    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const { coords } = position;
        const currentSpeed = Math.round((coords.speed || 0) * 3.6);
        setSpeed(currentSpeed);

        const location = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        currentLocationRef.current = location;

        if (!origin) {
          setOrigin(location);
        }

        const message = JSON.stringify({
          deviceId: deviceIdRef.current,
          latitude: coords.latitude,
          longitude: coords.longitude,
          speed: currentSpeed,
        });

        socket.send(message, 0, message.length, UDP_PORT, targetIp, (err) => {
          if (err) {console.log('UDP send error:', err);}
        });

        if (currentSpeed > SPEED_LIMIT_ALERT) {
          navigation.navigate('SpeedAlert', { speed: currentSpeed });
        }
      },
      (err) => console.log('Location error:', err),
      {
        enableHighAccuracy: true,
        distanceFilter: 1,
        interval: 1000,
        fastestInterval: 500,
      }
    );
  };

  const stopTracking = () => {
    setSpeed(0);
    currentLocationRef.current = null;
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const toggleTracking = (enable) => {
    setTracking(enable);
    if (enable) {
      startTracking();
    } else {
      stopTracking();
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        showsUserLocation={tracking}
        followsUserLocation={tracking}
        initialRegion={{
          latitude: 28.6139,
          longitude: 77.209,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {origin && <Marker coordinate={origin} title="You" />}
      </MapView>

      <View style={styles.controls}>
        <Text style={styles.statusText}>Tracking is {tracking ? 'ON' : 'OFF'}</Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, tracking ? styles.buttonSelected : styles.buttonInactive]}
            onPress={() => toggleTracking(true)}
          >
            <Text style={styles.buttonText}>ON</Text>
          </Pressable>
          <Pressable
            style={[styles.button, !tracking ? styles.buttonSelectedOff : styles.buttonInactive]}
            onPress={() => toggleTracking(false)}
          >
            <Text style={styles.buttonText}>OFF</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.speedBox}>
        <Text style={styles.speedText}>{speed} km/h</Text>
      </View>

      {nearbyAlert && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>NEARBY DANGER ALERT!</Text>
        </View>
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Target IP</Text>
            <TextInput
              placeholder="e.g. 192.168.55.123"
              value={targetIp}
              onChangeText={setTargetIp}
              keyboardType="numeric"
              style={styles.input}
            />
            <Pressable
              style={styles.modalButton}
              onPress={() => setModalVisible(false)}
              disabled={!targetIp}
            >
              <Text style={styles.modalButtonText}>Start</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: {
    position: 'absolute',
    top: 40,
    width: '100%',
    alignItems: 'center',
  },
  statusText: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#000' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: { paddingVertical: 10, paddingHorizontal: 25, borderRadius: 10, elevation: 3 },
  buttonSelected: { backgroundColor: 'green' },
  buttonSelectedOff: { backgroundColor: 'red' },
  buttonInactive: { backgroundColor: '#aaa' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  speedBox: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 10,
  },
  speedText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  alertBox: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    padding: 20,
    borderRadius: 12,
  },
  alertText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 15,
    width: '85%',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  input: {
    borderColor: '#888',
    borderWidth: 1,
    width: '100%',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 15,
  },
  modalButton: {
    backgroundColor: 'blue',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  modalButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default HomeScreen;
