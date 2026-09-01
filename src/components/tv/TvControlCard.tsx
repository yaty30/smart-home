import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useMemo, useState, useCallback } from 'react';
import {
  Power,
  VolumeX,
  Volume2,
  ChevronUp,
  ChevronDown,
  ChevronLeft as ArrowLeft,
  ChevronRight as ArrowRight,
  Circle,
  RotateCcw,
  Home,
  Menu,
  MonitorUp,
} from 'lucide-react-native';
import { type Theme, useTheme } from '../../theme/theme';
import type { Device } from '../../domain/device';
import type { Controller } from '../../domain/controller';
import { tvService } from '../../services/tvService';

type TvControlCardProps = {
  device: Device;
  controller: Controller;
};

export function TvControlCard({ device, controller }: TvControlCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [sendingCommand, setSendingCommand] = useState<string | null>(null);

  const sendCommand = useCallback(
    async (command: string) => {
      if (!controller.online || sendingCommand) {
        return;
      }

      setSendingCommand(command);

      try {
        await tvService.sendTvCommand(controller, device.controllerDeviceId!, command);
      } catch (error) {
        console.error(`Failed to send ${command}:`, error);
      } finally {
        setSendingCommand(null);
      }
    },
    [controller, device.controllerDeviceId, sendingCommand]
  );

  const renderButton = useCallback(
    (
      icon: React.ReactNode,
      label: string,
      command: string,
      variant: 'primary' | 'secondary' = 'secondary'
    ) => {
      const isActive = sendingCommand === command;
      const disabled = !controller.online || !!sendingCommand;

      return (
        <TouchableOpacity
          style={[
            styles.button,
            variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
            disabled && styles.buttonDisabled,
            isActive && styles.buttonActive,
          ]}
          onPress={() => void sendCommand(command)}
          disabled={disabled}
          accessibilityLabel={label}
        >
          {isActive ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <>
              {icon}
              <Text style={styles.buttonLabel}>{label}</Text>
            </>
          )}
        </TouchableOpacity>
      );
    },
    [controller.online, sendingCommand, sendCommand, styles, theme.accent]
  );

  const iconSize = 24;
  const iconColor = theme.text;

  return (
    <View style={styles.card}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Power</Text>
        <View style={styles.buttonRow}>
          {renderButton(
            <Power size={iconSize} color={iconColor} />,
            'Power On',
            'power_on',
            'primary'
          )}
          {renderButton(
            <Power size={iconSize} color={iconColor} />,
            'Power Off',
            'power_off',
            'secondary'
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Volume</Text>
        <View style={styles.buttonRow}>
          {renderButton(
            <Volume2 size={iconSize} color={iconColor} />,
            'Vol +',
            'volume_up'
          )}
          {renderButton(
            <VolumeX size={iconSize} color={iconColor} />,
            'Mute',
            'mute'
          )}
          {renderButton(
            <Volume2 size={iconSize} color={iconColor} />,
            'Vol −',
            'volume_down'
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Navigation</Text>
        <View style={styles.dpadContainer}>
          <View style={styles.dpadRow}>
            <View style={styles.dpadSpacer} />
            <TouchableOpacity
              style={[
                styles.dpadButton,
                (!controller.online || !!sendingCommand) && styles.buttonDisabled,
              ]}
              onPress={() => void sendCommand('up')}
              disabled={!controller.online || !!sendingCommand}
              accessibilityLabel="Up"
            >
              <ChevronUp size={28} color={iconColor} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.dpadSpacer} />
          </View>
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={[
                styles.dpadButton,
                (!controller.online || !!sendingCommand) && styles.buttonDisabled,
              ]}
              onPress={() => void sendCommand('left')}
              disabled={!controller.online || !!sendingCommand}
              accessibilityLabel="Left"
            >
              <ArrowLeft size={28} color={iconColor} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dpadButton,
                styles.dpadButtonCenter,
                (!controller.online || !!sendingCommand) && styles.buttonDisabled,
              ]}
              onPress={() => void sendCommand('ok')}
              disabled={!controller.online || !!sendingCommand}
              accessibilityLabel="OK"
            >
              <Circle size={28} color={iconColor} strokeWidth={2.5} fill={theme.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dpadButton,
                (!controller.online || !!sendingCommand) && styles.buttonDisabled,
              ]}
              onPress={() => void sendCommand('right')}
              disabled={!controller.online || !!sendingCommand}
              accessibilityLabel="Right"
            >
              <ArrowRight size={28} color={iconColor} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <View style={styles.dpadRow}>
            <View style={styles.dpadSpacer} />
            <TouchableOpacity
              style={[
                styles.dpadButton,
                (!controller.online || !!sendingCommand) && styles.buttonDisabled,
              ]}
              onPress={() => void sendCommand('down')}
              disabled={!controller.online || !!sendingCommand}
              accessibilityLabel="Down"
            >
              <ChevronDown size={28} color={iconColor} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.dpadSpacer} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.buttonRow}>
          {renderButton(
            <RotateCcw size={iconSize} color={iconColor} />,
            'Back',
            'back'
          )}
          {renderButton(
            <Home size={iconSize} color={iconColor} />,
            'Home',
            'home'
          )}
          {renderButton(
            <Menu size={iconSize} color={iconColor} />,
            'Menu',
            'menu'
          )}
        </View>
        <View style={styles.buttonRow}>
          {renderButton(
            <MonitorUp size={iconSize} color={iconColor} />,
            'Input',
            'input'
          )}
        </View>
      </View>

      {!controller.online && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineText}>Controller is offline</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.paperBackground,
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 16,
      marginTop: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
      letterSpacing: 0.15,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderRadius: 12,
      gap: 8,
      minHeight: 56,
    },
    buttonPrimary: {
      backgroundColor: theme.accent,
    },
    buttonSecondary: {
      backgroundColor: theme.controlBackground,
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    buttonActive: {
      opacity: 0.6,
    },
    buttonLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      letterSpacing: 0.15,
    },
    dpadContainer: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    dpadRow: {
      flexDirection: 'row',
      gap: 8,
    },
    dpadSpacer: {
      width: 64,
    },
    dpadButton: {
      width: 64,
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.controlBackground,
      borderRadius: 32,
    },
    dpadButtonCenter: {
      backgroundColor: theme.paperBackground,
      borderWidth: 2,
      borderColor: theme.accent,
    },
    offlineNotice: {
      marginTop: 8,
      padding: 16,
      backgroundColor: theme.surfaceWarm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.accentStrong,
    },
    offlineText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.accentStrong,
      textAlign: 'center',
      letterSpacing: 0.15,
    },
  });
