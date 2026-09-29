const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const telemetryState = `
  const [lat, setLat] = useState("0.000000");
  const [lng, setLng] = useState("0.000000");
  const [speed, setSpeed] = useState("0");
  const [accuracy, setAccuracy] = useState("0");
  const [isTracking, setIsTracking] = useState(false);
`;

content = content.replace(
  'const [isConnected, setIsConnected] = useState(false);',
  'const [isConnected, setIsConnected] = useState(false);' + telemetryState
);

const telemetryJSX = `
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
          onPress={() => setIsTracking(!isTracking)}
        >
          <MaterialIcons name={isTracking ? "stop" : "navigation"} size={24} color="#FFFFFF" />
          <Text style={styles.mainButtonText}>
            {isTracking ? "Parar Rota" : "Iniciar Rota"}
          </Text>
        </TouchableOpacity>
`;

content = content.replace(
  '</ScrollView>',
  telemetryJSX + '\n      </ScrollView>'
);

const telemetryStyles = `
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
`;

content = content.replace(
  '});',
  telemetryStyles + '\n});'
);

fs.writeFileSync('App.tsx', content);
