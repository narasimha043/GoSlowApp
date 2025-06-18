import React, { useEffect } from 'react';
import { View, Text, Alert,  StyleSheet } from 'react-native';
import Sound from 'react-native-sound';

// Set category for audio playback
Sound.setCategory('Playback');

const SpeedAlert = () => {
  useEffect(() => {
    const alertSound = new Sound('alert.mp3', Sound.MAIN_BUNDLE, (error) => {
      if (error) {
        console.log('  Failed to load sound:', error);
        Alert.alert('Error', 'Could not load alert sound.');
        return;
      }

      alertSound.play((success) => {
        if (!success) {
          console.log('  Playback failed');
          Alert.alert('Error', 'Alert sound playback failed.');
        } else {
          console.log(' Sound played successfully');
        }
      });
    });

    return () => {
      alertSound.release();
    };
  }, []);

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Speed Alert Activated</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 75,
    height: 70,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e53935',
  },
});

export default SpeedAlert;
