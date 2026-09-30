import * as TaskManager from 'expo-task-manager';
import * as turf from '@turf/turf';
import { Audio } from 'expo-av';
import { DeviceEventEmitter } from 'react-native';
import * as FileSystem from 'expo-file-system';

export const LOCATION_TASK_NAME = 'background-location-task';

// Global state for background task
let currentRouteLine: any = null;
let globalDeviationTolerance = 150;
let deviationCount = 0;
let locationHistory: { latitude: number, longitude: number, timestamp: string }[] = [];
let isRecording = false;
const WEBHOOK_URL = 'https://webhook.site/test'; // Replace with real webhook URL

export const setTaskConfig = (routeLine: any, deviationTolerance: number) => {
  currentRouteLine = routeLine;
  globalDeviationTolerance = deviationTolerance;
};

export const clearTaskConfig = () => {
    currentRouteLine = null;
    deviationCount = 0;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Task Error:", error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    if (locations && locations.length > 0) {
      const { latitude, longitude, speed, accuracy, timestamp } = locations[0].coords;

      // Emit event to update UI
      DeviceEventEmitter.emit('onLocationUpdate', {
        latitude,
        longitude,
        speed,
        accuracy
      });

      // Discard readings with accuracy > 25m
      if (accuracy > 25) {
        return;
      }

      locationHistory.push({
        latitude,
        longitude,
        timestamp: new Date(timestamp || Date.now()).toISOString()
      });
      if (locationHistory.length > 5) {
        locationHistory.shift();
      }

      if (currentRouteLine) {
        // Calculate orthogonal distance using Turf
        const point = turf.point([longitude, latitude]);
        const line = turf.lineString(currentRouteLine.coordinates);

        // pointToLineDistance returns distance in kilometers or degrees by default, we use kilometers and convert to meters
        const distanceKm = turf.pointToLineDistance(point, line, { units: 'kilometers' });
        const distanceMeters = distanceKm * 1000;

        console.log(`Distance to route: ${distanceMeters.toFixed(2)}m`);

        if (distanceMeters > globalDeviationTolerance) {
          deviationCount += 1;

          if (deviationCount >= 3) {
            if (!isRecording) {
              isRecording = true;
              (async () => {
                try {
                  await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                  });

                  const recording = new Audio.Recording();
                  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
                  await recording.startAsync();
                  console.log('Started recording audio...');

                  setTimeout(async () => {
                    try {
                      await recording.stopAndUnloadAsync();
                      const uri = recording.getURI();
                      console.log('Stopped recording audio', uri);

                      let audioBase64 = null;
                      if (uri) {
                        audioBase64 = await FileSystem.readAsStringAsync(uri, {
                          encoding: FileSystem.EncodingType.Base64,
                        });
                      }

                      // Trigger webhook
                      const payload = {
                        evento: "DESVIO_ROTA",
                        motorista: "Luca",
                        distancia_desvio_metros: parseFloat(distanceMeters.toFixed(2)),
                        coordenadas: { latitude, longitude },
                        velocidade: (speed || 0) * 3.6, // m/s to km/h
                        timestamp: new Date(timestamp || Date.now()).toISOString(),
                        historico_localizacao: [...locationHistory],
                        audio_base64: audioBase64
                      };

                      await fetch(WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      console.log('Webhook sent:', payload);
                    } catch (err) {
                      console.error('Webhook or audio error:', err);
                    } finally {
                      isRecording = false;
                      deviationCount = 0; // Reset counter after the event is handled
                    }
                  }, 20000);
                } catch (err) {
                  console.error('Failed to start recording', err);
                  isRecording = false;
                  deviationCount = 0;
                }
              })();
            }
          }
        } else {
          // Reset if we are back on track
          deviationCount = 0;
        }
      }
    }
  }
});
