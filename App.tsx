import React, { useState, useEffect } from 'react';


import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Linking, DeviceEventEmitter, Modal, TextInput, ActivityIndicator } from 'react-native';


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

  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);
  const [originInput, setOriginInput] = useState("");
  const [destinationInput, setDestinationInput] = useState("");
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [deviationTolerance, setDeviationTolerance] = useState("150");
  const [routeSummary, setRouteSummary] = useState<any>(null);
  const [configuredRoute, setConfiguredRoute] = useState<any>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const geocode = async (address: string) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'RotaSegura/1.0' }
      });
      const data = await response.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
    } catch (e) {
      console.error("Geocoding error", e);
    }
    return null;
  };

  const handleUseCurrentLocation = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setOriginInput(`${location.coords.latitude}, ${location.coords.longitude}`);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível obter a localização atual.");
    }
  };

  const handleAddWaypoint = () => {
    setWaypoints([...waypoints, ""]);
  };

  const handleUpdateWaypoint = (text: string, index: number) => {
    const newWaypoints = [...waypoints];
    newWaypoints[index] = text;
    setWaypoints(newWaypoints);
  };

  const handleTraceRoute = async () => {
    if (!originInput || !destinationInput) {
      Alert.alert("Erro", "Origem e Destino são obrigatórios.");
      return;
    }
    setIsLoadingRoute(true);
    setRouteSummary(null);

    const originCoords = await geocode(originInput) || (originInput.includes(',') ? { lat: parseFloat(originInput.split(',')[0]), lon: parseFloat(originInput.split(',')[1]) } : null);
    const destCoords = await geocode(destinationInput);

    if (!originCoords || !destCoords) {
      Alert.alert("Erro", "Não foi possível geocodificar a origem ou o destino.");
      setIsLoadingRoute(false);
      return;
    }

    let waypointsCoords = [];
    for (let wp of waypoints) {
      if (wp) {
        const coords = await geocode(wp);
        if (coords) waypointsCoords.push(coords);
      }
    }

    const allCoords = [
      `${originCoords.lon},${originCoords.lat}`,
      ...waypointsCoords.map(wp => `${wp.lon},${wp.lat}`),
      `${destCoords.lon},${destCoords.lat}`
    ];

    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${allCoords.join(';')}?geometries=geojson&overview=full&steps=true`);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);

        let roads: string[] = [];
        if (route.legs) {
          route.legs.forEach((leg: any) => {
            if (leg.steps) {
              leg.steps.forEach((step: any) => {
                if (step.name && !roads.includes(step.name)) roads.push(step.name);
              });
            }
          });
        }

        setRouteSummary({
          geometry: route.geometry,
          distanceKm,
          durationMin,
          roads: roads.slice(0, 5),
          originCoords,
          destCoords,
          originText: originInput,
          destText: destinationInput
        });
      } else {
        Alert.alert("Erro", "Nenhuma rota encontrada.");
      }
    } catch (e) {
      console.error("OSRM error", e);
      Alert.alert("Erro", "Falha ao buscar a rota.");
    }
    setIsLoadingRoute(false);
  };

  const handleConfirmRoute = () => {
    if (routeSummary) {
      setConfiguredRoute(routeSummary);
      setRouteLine(routeSummary.geometry);
      globalDeviationTolerance = parseFloat(deviationTolerance) || 150;
      setIsConfigModalVisible(false);
    }
  };

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

    if (!configuredRoute) {
      Alert.alert('Erro', 'Por favor, configure o trajeto antes de iniciar a rota.');
      return;
    }

    try {
      currentRouteLine = configuredRoute.geometry; // Set global for background task

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
      const { destCoords, originCoords } = configuredRoute;
      const navUrl = `google.navigation:q=${destCoords.lat},${destCoords.lon}&mode=d`;
      const supported = await Linking.canOpenURL(navUrl);

      if (supported) {
        await Linking.openURL(navUrl);
      } else {
        // Fallback for iOS or if Google Maps not installed
        const browserUrl = `https://www.google.com/maps/dir/?api=1&origin=${originCoords.lat},${originCoords.lon}&destination=${destCoords.lat},${destCoords.lon}&travelmode=driving`;
        await Linking.openURL(browserUrl);
      }

    } catch (error) {
      console.error("Error opening maps", error);
      Alert.alert('Erro', 'Não foi possível abrir o mapa.');
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
            <Text style={styles.driverInfoText}>ABC1234 • Rota: {configuredRoute ? `${configuredRoute.originText} -> ${configuredRoute.destText}` : 'Não configurada'}</Text>
          </View>
          <TouchableOpacity style={{marginTop: 10, alignSelf: 'flex-start'}} onPress={() => setIsConfigModalVisible(true)}>
            <Text style={{color: '#00897B', fontWeight: 'bold'}}>+ Configurar Trajeto</Text>
          </TouchableOpacity>
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
          style={[styles.mainButton, { backgroundColor: isTracking ? '#D32F2F' : (!configuredRoute ? '#B0BEC5' : '#00897B') }]}
          onPress={handleStartRoute}
          disabled={!configuredRoute && !isTracking}
        >
          <MaterialIcons name={isTracking ? "stop" : "navigation"} size={24} color="#FFFFFF" />
          <Text style={styles.mainButtonText}>
            {isTracking ? "Parar Rota" : "Iniciar Rota"}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={isConfigModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Configurar Rota</Text>

              <Text style={styles.inputLabel}>Origem</Text>
              <View style={styles.inputRow}>
                <TextInput style={styles.input} value={originInput} onChangeText={setOriginInput} placeholder="CEP ou Endereço" />
                <TouchableOpacity onPress={handleUseCurrentLocation} style={styles.iconBtn}>
                  <MaterialIcons name="my-location" size={20} color="#00897B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Destino</Text>
              <TextInput style={styles.input} value={destinationInput} onChangeText={setDestinationInput} placeholder="CEP ou Endereço" />

              {waypoints.map((wp, i) => (
                <View key={i}>
                  <Text style={styles.inputLabel}>Ponto de Parada {i + 1}</Text>
                  <TextInput style={styles.input} value={wp} onChangeText={t => handleUpdateWaypoint(t, i)} placeholder="CEP ou Endereço" />
                </View>
              ))}

              <TouchableOpacity style={styles.addWaypointBtn} onPress={handleAddWaypoint}>
                <Text style={styles.addWaypointText}>+ Adicionar Ponto de Parada</Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Tolerância de Desvio (m)</Text>
              <TextInput style={styles.input} value={deviationTolerance} onChangeText={setDeviationTolerance} keyboardType="numeric" />

              <TouchableOpacity style={styles.actionBtn} onPress={handleTraceRoute} disabled={isLoadingRoute}>
                {isLoadingRoute ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionBtnText}>Traçar Rota</Text>}
              </TouchableOpacity>

              {routeSummary && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Resumo do Trajeto</Text>
                  <Text>Distância: {routeSummary.distanceKm} km</Text>
                  <Text>Tempo Estimado: {routeSummary.durationMin} min</Text>
                  <Text style={{marginTop: 5, fontWeight: 'bold'}}>Vias Principais:</Text>
                  {routeSummary.roads.map((r: string, i: number) => <Text key={i} style={{fontSize: 12}}>- {r}</Text>)}

                  <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#4CAF50', marginTop: 15}]} onPress={handleConfirmRoute}>
                    <Text style={styles.actionBtnText}>Confirmar e Salvar</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsConfigModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
    marginTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#333',
  },
  iconBtn: {
    padding: 10,
    marginLeft: 10,
    backgroundColor: '#E0F2F1',
    borderRadius: 8,
  },
  addWaypointBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addWaypointText: {
    color: '#00897B',
    fontWeight: 'bold',
  },
  actionBtn: {
    backgroundColor: '#00897B',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelBtn: {
    marginTop: 15,
    padding: 15,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#D32F2F',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryCard: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#F1F8E9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C5E1A5',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#33691E',
  },
});


// Global state for background task
let currentRouteLine: any = null;
let globalDeviationTolerance = 150;
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

        if (distanceMeters > globalDeviationTolerance) {
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
