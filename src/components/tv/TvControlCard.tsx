import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Settings,
  Triangle,
  VolumeOff,
  Power,
  Cast,
  Grid3x3,
  SkipBack,
  Play,
  Pause,
  SkipForward,
} from 'lucide-react-native';
import { type Theme, useTheme } from '../../theme/theme';
import type { Device } from '../../domain/device';
import type { Controller } from '../../domain/controller';
import { tvService } from '../../services/tvService';

type TvControlCardProps = {
  device: Device;
  controller: Controller;
};

const REMOTE_ACCENT = '#3B82F6';
const REMOTE_TEXT = '#FFFFFF';
const REMOTE_BG_DARK = '#1A1A1C';
const REMOTE_BG_MEDIUM = '#242426';
const REMOTE_BG_LIGHT = '#2F2F32';

export function TvControlCard({ device, controller }: TvControlCardProps) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const remotePadSize = Math.min(320, Math.max(240, windowWidth - 72));
  const styles = useMemo(() => createStyles(theme, remotePadSize), [theme, remotePadSize]);

  const [sendingCommand, setSendingCommand] = useState<string | null>(null);
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const sendCommand = useCallback(
    async (command: string) => {
      if (!controller.online || sendingCommand) {
        return;
      }

      setSendingCommand(command);

      try {
        await tvService.sendTvCommand(controller, device.controllerDeviceId!, command);

        if (command === 'power') {
          setIsPowerOn(prev => !prev);
        } else if (command === 'play_pause') {
          setIsPlaying(prev => !prev);
        }
      } catch (error) {
        console.error(`Failed to send ${command}:`, error);
      } finally {
        setSendingCommand(null);
      }
    },
    [controller, device.controllerDeviceId, sendingCommand]
  );

  const renderKey = useCallback(
    (
      label: string,
      command: string,
      content: ReactNode,
      keyStyle?: StyleProp<ViewStyle>
    ) => {
      const isActive = sendingCommand === command;
      const disabled = !controller.online || !!sendingCommand;

      return (
        <TouchableOpacity
          style={[
            styles.remoteKey,
            keyStyle,
            disabled && styles.buttonDisabled,
            isActive && styles.buttonActive,
          ]}
          onPress={() => void sendCommand(command)}
          disabled={disabled}
          accessibilityLabel={label}
          activeOpacity={0.7}
        >
          {isActive ? (
            <ActivityIndicator size="small" color={REMOTE_ACCENT} />
          ) : (
            content
          )}
        </TouchableOpacity>
      );
    },
    [controller.online, sendingCommand, sendCommand, styles]
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {renderKey(
          'Cast',
          'cast',
          <Cast color={REMOTE_ACCENT} size={22} strokeWidth={2} />,
          styles.headerButton
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.deviceName} numberOfLines={1}>
            {device.name}
          </Text>
          <Text style={styles.deviceModel} numberOfLines={1}>
            {device.modelId || 'TV Remote'}
          </Text>
        </View>
        {renderKey(
          'Power',
          'power',
          <Power
            color={isPowerOn ? '#EF4444' : REMOTE_TEXT}
            size={22}
            strokeWidth={2}
          />,
          styles.headerButton
        )}
      </View>

      <View style={styles.remoteControlRow}>
        <View style={styles.rocker}>
          {renderKey(
            'Channel up',
            'channel_up',
            <ChevronUp color={REMOTE_TEXT} size={22} strokeWidth={2.5} />,
            styles.rockerButton
          )}
          <Text style={styles.rockerLabel}>CH</Text>
          {renderKey(
            'Channel down',
            'channel_down',
            <ChevronDown color={REMOTE_TEXT} size={22} strokeWidth={2.5} />,
            styles.rockerButton
          )}
        </View>

        <View style={styles.utilityStack}>
          {renderKey(
            'Settings',
            'menu',
            <Settings color={REMOTE_TEXT} size={24} strokeWidth={2} />,
            styles.utilityButton
          )}
          {renderKey(
            'Mute',
            'mute',
            <VolumeOff color={REMOTE_TEXT} size={24} strokeWidth={2} />,
            styles.utilityButton
          )}
        </View>

        <View style={styles.rocker}>
          {renderKey(
            'Volume up',
            'volume_up',
            <ChevronUp color={REMOTE_TEXT} size={22} strokeWidth={2.5} />,
            styles.rockerButton
          )}
          <Text style={styles.rockerLabel}>VOL</Text>
          {renderKey(
            'Volume down',
            'volume_down',
            <ChevronDown color={REMOTE_TEXT} size={22} strokeWidth={2.5} />,
            styles.rockerButton
          )}
        </View>
      </View>

      <View style={styles.remotePad}>
        {renderKey(
          'Menu',
          'menu',
          <Text style={styles.remoteText}>MENU</Text>,
          [styles.remoteRoundKey, styles.remoteMenuKey]
        )}
        {renderKey(
          'Up',
          'up',
          <Triangle
            color={REMOTE_ACCENT}
            fill={REMOTE_ACCENT}
            size={16}
            strokeWidth={0}
          />,
          [styles.remoteVerticalKey, styles.remoteUpKey]
        )}
        {renderKey(
          'Back',
          'back',
          <Text style={styles.remoteText}>BACK</Text>,
          [styles.remoteRoundKey, styles.remoteBackKey]
        )}
        {renderKey(
          'Left',
          'left',
          <Triangle
            color={REMOTE_ACCENT}
            fill={REMOTE_ACCENT}
            size={16}
            strokeWidth={0}
            style={styles.arrowLeft}
          />,
          [styles.remoteHorizontalKey, styles.remoteLeftKey]
        )}
        {renderKey(
          'OK',
          'ok',
          <Text style={styles.okText}>OK</Text>,
          [styles.remoteCenterKey]
        )}
        {renderKey(
          'Right',
          'right',
          <Triangle
            color={REMOTE_ACCENT}
            fill={REMOTE_ACCENT}
            size={16}
            strokeWidth={0}
            style={styles.arrowRight}
          />,
          [styles.remoteHorizontalKey, styles.remoteRightKey]
        )}
        {renderKey(
          'Input',
          'input',
          <Text style={styles.remoteText}>INPUT</Text>,
          [styles.remoteRoundKey, styles.remoteInputKey]
        )}
        {renderKey(
          'Down',
          'down',
          <Triangle
            color={REMOTE_ACCENT}
            fill={REMOTE_ACCENT}
            size={16}
            strokeWidth={0}
            style={styles.arrowDown}
          />,
          [styles.remoteVerticalKey, styles.remoteDownKey]
        )}
        {renderKey(
          'Exit',
          'exit',
          <Text style={styles.remoteText}>EXIT</Text>,
          [styles.remoteRoundKey, styles.remoteExitKey]
        )}
      </View>

      <View style={styles.mediaControls}>
        {renderKey(
          'Apps',
          'apps',
          <Grid3x3 color={REMOTE_TEXT} size={20} strokeWidth={2} />,
          styles.mediaButton
        )}
        {renderKey(
          'Previous',
          'previous',
          <SkipBack color={REMOTE_TEXT} size={20} strokeWidth={2} />,
          styles.mediaButton
        )}
        {renderKey(
          'Play/Pause',
          'play_pause',
          isPlaying ? (
            <Pause color={REMOTE_TEXT} size={20} strokeWidth={2} fill={REMOTE_TEXT} />
          ) : (
            <Play color={REMOTE_TEXT} size={20} strokeWidth={2} fill={REMOTE_TEXT} />
          ),
          styles.mediaButton
        )}
        {renderKey(
          'Next',
          'next',
          <SkipForward color={REMOTE_TEXT} size={20} strokeWidth={2} />,
          styles.mediaButton
        )}
        {renderKey(
          'Power',
          'power',
          <Power
            color={isPowerOn ? '#EF4444' : REMOTE_TEXT}
            size={20}
            strokeWidth={2}
          />,
          styles.mediaButton
        )}
      </View>

      {!controller.online && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineText}>Controller is offline</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: Theme, remotePadSize: number) => {
  const roundKeySize = remotePadSize * 0.24;
  const verticalKeyWidth = roundKeySize;
  const verticalKeyHeight = remotePadSize * 0.30;
  const horizontalKeyWidth = remotePadSize * 0.30;
  const horizontalKeyHeight = roundKeySize;
  const centerKeySize = remotePadSize * 0.26;

  return StyleSheet.create({
    card: {
      backgroundColor: REMOTE_BG_DARK,
      borderRadius: 24,
      padding: 20,
      marginHorizontal: 16,
      marginTop: 16,
      gap: 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    headerButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: REMOTE_BG_MEDIUM,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    deviceName: {
      color: REMOTE_TEXT,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.2,
      marginBottom: 2,
    },
    deviceModel: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: 13,
      fontWeight: '500',
      letterSpacing: 0.1,
    },
    remoteControlRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    remoteKey: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: REMOTE_BG_LIGHT,
    },
    rocker: {
      width: 68,
      minHeight: 168,
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: REMOTE_BG_MEDIUM,
      borderRadius: 34,
      paddingVertical: 14,
      paddingHorizontal: 10,
    },
    rockerButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: REMOTE_BG_LIGHT,
    },
    rockerLabel: {
      color: REMOTE_TEXT,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    utilityStack: {
      alignSelf: 'stretch',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 2,
    },
    utilityButton: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: REMOTE_BG_MEDIUM,
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    buttonActive: {
      opacity: 0.6,
    },
    remotePad: {
      width: remotePadSize,
      height: remotePadSize,
      alignSelf: 'center',
      position: 'relative',
      backgroundColor: REMOTE_BG_MEDIUM,
      borderRadius: remotePadSize * 0.18,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 10,
    },
    remoteRoundKey: {
      width: roundKeySize,
      height: roundKeySize,
      borderRadius: roundKeySize / 2,
      position: 'absolute',
      backgroundColor: REMOTE_BG_LIGHT,
    },
    remoteVerticalKey: {
      width: verticalKeyWidth,
      height: verticalKeyHeight,
      borderRadius: verticalKeyWidth / 2,
      position: 'absolute',
      backgroundColor: REMOTE_BG_LIGHT,
    },
    remoteHorizontalKey: {
      width: horizontalKeyWidth,
      height: horizontalKeyHeight,
      borderRadius: horizontalKeyHeight / 2,
      position: 'absolute',
      backgroundColor: REMOTE_BG_LIGHT,
    },
    remoteCenterKey: {
      width: centerKeySize,
      height: centerKeySize,
      borderRadius: centerKeySize / 2,
      left: (remotePadSize - centerKeySize) / 2,
      top: (remotePadSize - centerKeySize) / 2,
      position: 'absolute',
      backgroundColor: '#27272A',
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    remoteMenuKey: {
      left: remotePadSize * 0.12,
      top: remotePadSize * 0.07,
    },
    remoteUpKey: {
      left: (remotePadSize - verticalKeyWidth) / 2,
      top: remotePadSize * 0.055,
    },
    remoteBackKey: {
      right: remotePadSize * 0.12,
      top: remotePadSize * 0.07,
    },
    remoteLeftKey: {
      left: remotePadSize * 0.06,
      top: (remotePadSize - horizontalKeyHeight) / 2,
    },
    remoteRightKey: {
      right: remotePadSize * 0.06,
      top: (remotePadSize - horizontalKeyHeight) / 2,
    },
    remoteInputKey: {
      left: remotePadSize * 0.12,
      bottom: remotePadSize * 0.07,
    },
    remoteDownKey: {
      left: (remotePadSize - verticalKeyWidth) / 2,
      bottom: remotePadSize * 0.055,
    },
    remoteExitKey: {
      right: remotePadSize * 0.12,
      bottom: remotePadSize * 0.07,
    },
    remoteText: {
      color: REMOTE_TEXT,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    okText: {
      color: REMOTE_TEXT,
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    arrowLeft: {
      transform: [{ rotate: '-90deg' }],
    },
    arrowRight: {
      transform: [{ rotate: '90deg' }],
    },
    arrowDown: {
      transform: [{ rotate: '180deg' }],
    },
    mediaControls: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: REMOTE_BG_MEDIUM,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
    mediaButton: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: 'transparent',
    },
    offlineNotice: {
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
};
