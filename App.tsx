import { StatusBar } from 'react-native';

import { AirConditionerScreen } from './src/screens/AirConditionerScreen';
import { theme } from './src/theme/theme';

export default function App() {
  return (
    <>
      <StatusBar
        backgroundColor={theme.root}
        barStyle="light-content"
        translucent={false}
      />
      <AirConditionerScreen />
    </>
  );
}
