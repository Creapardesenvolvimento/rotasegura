const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const importTaskManager = `
import * as TaskManager from 'expo-task-manager';
`;

content = content.replace(
  "import * as Location from 'expo-location';",
  "import * as Location from 'expo-location';\n" + importTaskManager
);

const backgroundTaskName = `
const LOCATION_TASK_NAME = 'background-location-task';
`;

content = content.replace(
  'export default function App() {',
  backgroundTaskName + '\nexport default function App() {'
);

const startTrackingLogic = `
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
`;

content = content.replace(
  '      // Start Tracking\n      setIsTracking(true);',
  '      // Start Tracking\n      setIsTracking(true);\n' + startTrackingLogic
);

const stopTrackingLogic = `
      // Parar Rota
      setIsTracking(false);
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
`;

content = content.replace(
  '      // Parar Rota\n      setIsTracking(false);\n      // We will handle stop tracking logic here\n      return;',
  stopTrackingLogic
);


fs.writeFileSync('App.tsx', content);
