const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const importDeviceEventEmitter = `
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Linking, DeviceEventEmitter } from 'react-native';
`;

content = content.replace(
  "import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';",
  importDeviceEventEmitter
);

const eventEmitterEmit = `
      // Emit event to update UI
      DeviceEventEmitter.emit('onLocationUpdate', {
        latitude,
        longitude,
        speed,
        accuracy
      });
`;

content = content.replace(
  '      // We could use an event emitter or AsyncStorage to update UI, \n      // but for background task logic we do it here.',
  eventEmitterEmit
);

const useEffectListener = `
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('onLocationUpdate', (location) => {
      setLat(location.latitude.toFixed(6));
      setLng(location.longitude.toFixed(6));
      setSpeed(((location.speed || 0) * 3.6).toFixed(1));
      setAccuracy(location.accuracy.toFixed(1));
    });

    return () => {
      subscription.remove();
    };
  }, []);
`;

content = content.replace(
  '  useEffect(() => {\n    (async () => {',
  useEffectListener + '\n  useEffect(() => {\n    (async () => {'
);

fs.writeFileSync('App.tsx', content);
