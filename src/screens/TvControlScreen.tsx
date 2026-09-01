import { StyleSheet, View, ScrollView } from 'react-native';
import { useMemo, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import { useDevices } from '../store/devices';
import { useControllers } from '../store/controllers';
import { type Theme, useTheme } from '../theme/theme';
import { AppHeader, HeaderIconButton } from '../components/AppHeader';
import { TvControlCard } from '../components/tv/TvControlCard';

type TvControlScreenProps = {
  deviceId: string;
  onBackPress: () => void;
};

export function TvControlScreen({ deviceId, onBackPress }: TvControlScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { getDeviceById } = useDevices();
  const { getControllerById } = useControllers();

  const device = getDeviceById(deviceId);
  const controller = device ? getControllerById(device.controllerId) : undefined;

  const handleBackPress = useCallback(() => {
    onBackPress();
  }, [onBackPress]);

  if (!device || !controller) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        leftAction={
          <HeaderIconButton accessibilityLabel="Back" onPress={handleBackPress}>
            <ChevronLeft color={theme.accent} size={26} strokeWidth={2.35} />
          </HeaderIconButton>
        }
        title={device.name}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <TvControlCard device={device} controller={controller} />
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.root,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 32,
    },
  });
