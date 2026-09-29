const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const importLines = `import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
`;

content = content.replace(
  "import React, { useState } from 'react';\nimport { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';\nimport { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';",
  importLines
);

const useEffectBlock = `
  useEffect(() => {
    (async () => {
      // Camera
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        Alert.alert('Permissão necessária', 'O app precisa da câmera para funcionar corretamente.');
      }

      // Audio
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      if (audioStatus !== 'granted') {
        Alert.alert('Permissão necessária', 'O app precisa do microfone para funcionar corretamente.');
      }

      // Location Foreground
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert('Permissão necessária', 'O app precisa da localização para rastrear a rota.');
        return;
      }

      // Location Background
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        Alert.alert('Permissão necessária', 'O app precisa da localização em segundo plano para rastrear a rota.');
      }
    })();
  }, []);
`;

content = content.replace(
  'const [isTracking, setIsTracking] = useState(false);',
  'const [isTracking, setIsTracking] = useState(false);\n' + useEffectBlock
);

fs.writeFileSync('App.tsx', content);
