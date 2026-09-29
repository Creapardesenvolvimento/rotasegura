import React, { useState, useEffect } from 'react';


import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Linking, DeviceEventEmitter } from 'react-native';


import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Location from 'expo-location';

import * as TaskManager from 'expo-task-manager';

import * as turf from '@turf/turf';


import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';



const LOCATION_TASK_NAME = 'background-location-task';

export default function App() {
  const [driverName, setDriverName] = useState("Luca");
  const [isConnected, setIsConnected] = useState(false);
  const [lat, setLat] = useState("0.000000");
  const [lng, setLng] = useState("0.000000");
  const [speed, setSpeed] = useState("0");
  const [accuracy, setAccuracy] = useState("0");
  const [isTracking, setIsTracking] = useState(false);


  const [routeLine, setRouteLine] = useState<any>(null); // To store GeoJSON LineString

  // Dummy origins for demo
  const originLat = -23.550520;
  const originLng = -46.633308;
  const destLat = -23.561414;
  const destLng = -46.656402;

  const handleStartRoute = async () => {
    if (isTracking) {

      // Parar Rota
      setIsTracking(false);
      currentRouteLine = null;
      deviationCount = 0;
      try {
        const hasTask = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (hasTask) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          console.log("Stopped location updates");
        }
      } catch (e) {
        console.error("Error stopping location updates", e);
      }
      return;

    }

    try {
      // Fetch Route from OSRM
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?geometries=geojson`);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0].geometry; // GeoJSON LineString
        setRouteLine(route);
        currentRouteLine = route; // Set global for background task
        console.log("Route fetched successfully.");
      }

      // Start Tracking
      setIsTracking(true);

      // Start Location Updates
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 10,
        foregroundService: {
          notificationTitle: 'RotaSegura',
          notificationBody: 'Monitorando trajeto...',
          notificationColor: '#00897B',
        },
      });


      // Open Google Maps
      const navUrl = `google.navigation:q=${destLat},${destLng}&mode=d`;
      const supported = await Linking.canOpenURL(navUrl);

      if (supported) {
        await Linking.openURL(navUrl);
      } else {
        // Fallback for iOS or if Google Maps not installed
        const browserUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
        await Linking.openURL(browserUrl);
      }

    } catch (error) {
      console.error("Error fetching route or opening maps", error);
      Alert.alert('Erro', 'Não foi possível buscar a rota ou abrir o mapa.');
    }
  };


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



  return (
    <View style={styles.container}>
      {/* Header Superior */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="alt-route" size={24} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.title}>RotaSegura</Text>
            <Text style={styles.subtitle}>APLICATIVO DO MOTORISTA</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn}>
          <MaterialIcons name="logout" size={24} color="#00897B" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header do Motorista */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bom trabalho, {driverName}</Text>
          <View style={styles.driverInfoRow}>
            <FontAwesome5 name="car" size={16} color="#555" />
            <Text style={styles.driverInfoText}>ABC1234 • Rota: 01000-000 -&gt; 02000-000</Text>
          </View>
        </View>

        {/* Card de Status de Conexão */}
        <View style={styles.card}>
          <View style={styles.connectionRow}>
            <Text style={styles.connectionText}>Conexão com a central</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
              <Text style={styles.statusText}>{isConnected ? 'Conectado' : 'Desconectado'}</Text>
            </View>
          </View>
        </View>

        {/* Grid de Telemetria */}
        <View style={styles.telemetryGrid}>
          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryLabel}>Latitude</Text>
            <Text style={styles.telemetryValue}>{lat}</Text>
          </View>
          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryLabel}>Longitude</Text>
            <Text style={styles.telemetryValue}>{lng}</Text>
          </View>
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryTitleRow}>
              <MaterialIcons name="speed" size={16} color="#777" />
              <Text style={styles.telemetryLabel}>Velocidade</Text>
            </View>
            <Text style={styles.telemetryValue}>{speed} km/h</Text>
          </View>
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryTitleRow}>
              <MaterialIcons name="gps-fixed" size={16} color="#777" />
              <Text style={styles.telemetryLabel}>Precisão</Text>
            </View>
            <Text style={styles.telemetryValue}>{accuracy} m</Text>
          </View>
        </View>

        {/* Card de Status de Rastreamento */}
        <View style={styles.card}>
          <Text style={styles.trackingTitle}>
            {isTracking ? "Monitoramento ativo" : "Aguardando posição"}
          </Text>
          <Text style={styles.trackingSubtitle}>Limite de desvio: 150 m</Text>
        </View>

        {/* Botão de Ação */}
        <TouchableOpacity
          style={[styles.mainButton, { backgroundColor: isTracking ? '#D32F2F' : '#00897B' }]}
          onPress={handleStartRoute}
        >
          <MaterialIcons name={isTracking ? "stop" : "navigation"} size={24} color="#FFFFFF" />
          <Text style={styles.mainButtonText}>
            {isTracking ? "Parar Rota" : "Iniciar Rota"}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: '#00897B',
    borderRadius: 8,
    padding: 8,
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 10,
    color: '#004D40',
    fontWeight: 'bold',
  },
  logoutBtn: {
    padding: 8,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverInfoText: {
    marginLeft: 10,
    color: '#555',
    fontSize: 14,
  },
  connectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionText: {
    fontSize: 16,
    color: '#333',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F1F1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },

  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  telemetryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  telemetryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  telemetryLabel: {
    fontSize: 12,
    color: '#777',
    marginLeft: 4,
  },
  telemetryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  trackingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  trackingSubtitle: {
    fontSize: 14,
    color: '#777',
  },
  mainButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 30,
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },

});


// Global state for background task
let currentRouteLine: any = null;
let deviationCount = 0;
const WEBHOOK_URL = 'https://webhook.site/test'; // Replace with real webhook URL

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Task Error:", error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    if (locations && locations.length > 0) {
      const location = locations[0];
      const { latitude, longitude, speed, accuracy, timestamp } = location.coords;


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

      if (currentRouteLine) {
        // Calculate orthogonal distance using Turf
        const point = turf.point([longitude, latitude]);
        const line = turf.lineString(currentRouteLine.coordinates);

        // pointToLineDistance returns distance in kilometers or degrees by default, we use kilometers and convert to meters
        const distanceKm = turf.pointToLineDistance(point, line, { units: 'kilometers' });
        const distanceMeters = distanceKm * 1000;

        console.log(`Distance to route: ${distanceMeters.toFixed(2)}m`);

        if (distanceMeters > 150) {
          deviationCount += 1;

          if (deviationCount >= 3) {
            // Trigger webhook
            const payload = {
              evento: "DESVIO_ROTA",
              motorista: "Luca",
              distancia_desvio_metros: parseFloat(distanceMeters.toFixed(2)),
              coordenadas: { latitude, longitude },
              velocidade: (speed || 0) * 3.6, // m/s to km/h
              timestamp: new Date(timestamp || Date.now()).toISOString()
            };

            try {
              await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              console.log('Webhook sent:', payload);
            } catch (err) {
              console.error('Webhook error:', err);
            }

            // Reset counter to avoid spamming
            deviationCount = 0;
          }
        } else {
          // Reset if we are back on track
          deviationCount = 0;
        }
      }
    }
  }
});
