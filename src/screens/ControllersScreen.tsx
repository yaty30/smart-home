import { ChevronLeft, QrCode, Wifi, WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert } from 'react-native';
import { useEffect } from 'react';
import { useControllers } from '../store/controllers';
import { useDevices } from '../store/devices';
import { useRooms } from '../store/rooms';
import { theme } from '../theme/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { AppHeader, HeaderIconButton } from '../components/AppHeader';
import { SwipeableItem } from '../components/SwipeableItem';
import { controllerHealthService } from '../services/controllerHealthService';

type ControllersScreenProps = RootStackScreenProps<'Controllers'>;

export function ControllersScreen({ navigation }: ControllersScreenProps) {
  const { controllers, removeController, updateControllerOnlineStatus } = useControllers();
  const { getDevicesByController } = useDevices();
  const { getRoomById } = useRooms();

  useEffect(() => {
    controllerHealthService.start(controllers, updateControllerOnlineStatus);

    return () => {
      controllerHealthService.stop();
    };
  }, [controllers, updateControllerOnlineStatus]);

  const handleDeleteController = (controllerId: string, controllerName: string) => {
    const devices = getDevicesByController(controllerId);
    const deviceCount = devices.length;

    const message = deviceCount > 0
      ? `This controller is assigned to ${deviceCount} ${deviceCount === 1 ? 'device' : 'devices'}.\n\nDeleting the controller will not delete the devices, but they will no longer be controllable.\n\nAre you sure you want to delete ${controllerName}?`
      : `Are you sure you want to delete ${controllerName}?`;

    Alert.alert(
      'Delete Controller',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void removeController(controllerId);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        leftAction={
          <HeaderIconButton
            accessibilityLabel="Back"
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main');
              }
            }}
          >
            <ChevronLeft color={theme.accent} size={26} strokeWidth={2.35} />
          </HeaderIconButton>
        }
        rightAction={
          <HeaderIconButton
            accessibilityLabel="Pair controller"
            framed
            onPress={() => navigation.navigate('PairController')}
          >
            <QrCode color={theme.accent} size={22} strokeWidth={2.5} />
          </HeaderIconButton>
        }
        title="Controllers"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {controllers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No controllers paired</Text>
            <Text style={styles.emptyHint}>
              Pair an ESP32 controller to control devices
            </Text>
          </View>
        ) : (
          <View style={styles.controllerList}>
            {controllers.map((controller) => {
              const deviceCount = getDevicesByController(controller.id).length;
              const StatusIcon = controller.online ? Wifi : WifiOff;
              const room = controller.roomId ? getRoomById(controller.roomId) : null;

              return (
                <SwipeableItem
                  key={controller.id}
                  onDelete={() => handleDeleteController(controller.id, controller.name)}
                  style={styles.swipeableContainer}
                >
                  <View style={styles.controllerCard}>
                    <View style={styles.controllerHeader}>
                      <View style={styles.controllerIcon}>
                        <StatusIcon
                          color={controller.online ? theme.accent : theme.textMuted}
                          size={22}
                          strokeWidth={2.2}
                        />
                      </View>
                      <View style={styles.controllerInfo}>
                        <Text numberOfLines={1} style={styles.controllerName}>
                          {controller.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.controllerStatus,
                            controller.online && styles.controllerStatusOnline,
                          ]}
                        >
                          {controller.online ? 'Online' : 'Offline'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.controllerDetails}>
                      {room && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Location</Text>
                          <Text numberOfLines={1} style={styles.detailValue}>
                            {room.name}
                          </Text>
                        </View>
                      )}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Controller ID</Text>
                        <Text numberOfLines={1} style={styles.detailValue}>
                          {controller.controllerId}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>IP Address</Text>
                        <Text numberOfLines={1} style={styles.detailValue}>
                          {controller.ip}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Devices</Text>
                        <Text style={styles.detailValue}>
                          {deviceCount} {deviceCount === 1 ? 'device' : 'devices'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </SwipeableItem>
              );
            })}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.root,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xxxl,
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
  },
  emptyHint: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
  controllerList: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  swipeableContainer: {
    borderRadius: theme.radiusMedium,
  },
  controllerCard: {
    backgroundColor: theme.surfaceWarm,
    borderColor: theme.border,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  controllerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  controllerIcon: {
    alignItems: 'center',
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
    borderRadius: 15,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  controllerInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  controllerName: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  controllerStatus: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
  },
  controllerStatusOnline: {
    color: '#4ADE80',
  },
  controllerDetails: {
    backgroundColor: theme.controlBackground,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: theme.radiusSmall,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
  },
  detailValue: {
    color: theme.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'right',
  },
});
