const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const turfImports = `
import * as turf from '@turf/turf';
`;

content = content.replace(
  "import * as TaskManager from 'expo-task-manager';",
  "import * as TaskManager from 'expo-task-manager';\n" + turfImports
);

const backgroundTaskDefinition = `
// Global state for background task
let currentRouteLine = null;
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

      // We could use an event emitter or AsyncStorage to update UI,
      // but for background task logic we do it here.

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

        console.log(\`Distance to route: \${distanceMeters.toFixed(2)}m\`);

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
`;

// Insert at the bottom of the file
content = content + '\n' + backgroundTaskDefinition;


// Update route assignment
content = content.replace(
  '        setRouteLine(route);\n        console.log("Route fetched successfully.");',
  '        setRouteLine(route);\n        currentRouteLine = route; // Set global for background task\n        console.log("Route fetched successfully.");'
);

// Clear route assignment on stop
content = content.replace(
  '      setIsTracking(false);\n      try {',
  '      setIsTracking(false);\n      currentRouteLine = null;\n      deviationCount = 0;\n      try {'
);


fs.writeFileSync('App.tsx', content);
