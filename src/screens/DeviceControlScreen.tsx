import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useDevices } from '../store/devices';
import { useControllers } from '../store/controllers';
import { type Theme, useTheme } from '../theme/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { AirConditionerScreen } from './AirConditionerScreen';
import { useEffect } from 'react';
import { deviceService } from '../services/deviceService';
import { DeviceConnectionProvider } from '../context/DeviceConnectionContext';
import { isDebugMode } from '../config/debug';

type DeviceControlScreenProps = RootStackScreenProps<'DeviceControl'>;

export function DeviceControlScreen({ navigation, route }: DeviceControlScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { deviceId } = route.params;
  const { getDeviceById } = useDevices();
  const { getControllerById } = useControllers();

  const device = getDeviceById(deviceId);
  const controller = device ? getControllerById(device.controllerId) : undefined;

  useEffect(() => {
    deviceService.initialize(getDeviceById, getControllerById);
  }, [getDeviceById, getControllerById]);

  if (!device) {
    return (
      <View style={styles.screen}>
        <Text style={styles.errorText}>Device not found</Text>
      </View>
    );
  }

  if (!controller) {
    return (
      <View style={styles.screen}>
        <Text style={styles.errorText}>Controller not found</Text>
      </View>
    );
  }

  if (device.type === 'ac') {
    return (
      <DeviceConnectionProvider deviceId={deviceId} debugMode={isDebugMode}>
        <AirConditionerScreen
          deviceId={deviceId}
          onBackPress={() => navigation.goBack()}
        />
      </DeviceConnectionProvider>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.errorText}>
        Control screen for {device.type} not implemented yet
      </Text>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: theme.root,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  errorText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
});
