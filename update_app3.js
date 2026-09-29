const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const importLinking = `
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
`;

content = content.replace(
  "import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';",
  importLinking
);

const fetchRouteFn = `
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
      // We will handle stop tracking logic here
      return;
    }

    try {
      // Fetch Route from OSRM
      const response = await fetch(\`https://router.project-osrm.org/route/v1/driving/\${originLng},\${originLat};\${destLng},\${destLat}?geometries=geojson\`);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0].geometry; // GeoJSON LineString
        setRouteLine(route);
        console.log("Route fetched successfully.");
      }

      // Start Tracking
      setIsTracking(true);

      // Open Google Maps
      const navUrl = \`google.navigation:q=\${destLat},\${destLng}&mode=d\`;
      const supported = await Linking.canOpenURL(navUrl);

      if (supported) {
        await Linking.openURL(navUrl);
      } else {
        // Fallback for iOS or if Google Maps not installed
        const browserUrl = \`https://www.google.com/maps/dir/?api=1&origin=\${originLat},\${originLng}&destination=\${destLat},\${destLng}&travelmode=driving\`;
        await Linking.openURL(browserUrl);
      }

    } catch (error) {
      console.error("Error fetching route or opening maps", error);
      Alert.alert('Erro', 'Não foi possível buscar a rota ou abrir o mapa.');
    }
  };
`;

content = content.replace(
  '  useEffect(() => {',
  fetchRouteFn + '\n  useEffect(() => {'
);


content = content.replace(
  'onPress={() => setIsTracking(!isTracking)}',
  'onPress={handleStartRoute}'
);

fs.writeFileSync('App.tsx', content);
