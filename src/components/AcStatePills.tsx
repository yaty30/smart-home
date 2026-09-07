import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DraftingCompass, Fan, Moon, Zap } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DeviceState } from '../domain/device';
import { MODE_ICONS } from '../constants/acModes';
import { useTheme, type Theme } from '../theme/theme';
import {
  horizontalAirflowOptions,
  verticalAirflowOptions,
} from './AirflowSelectors';

type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

type AcStatePillsProps = {
  state: DeviceState;
};

export function AcStatePills({ state }: AcStatePillsProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const modeIcons = useMemo(() => MODE_ICONS(theme), [theme]);

  const modeConfig = state.mode
    ? modeIcons[state.mode as keyof typeof modeIcons] ?? null
    : null;
  const ModeIcon = modeConfig?.icon;

  const verticalOption = verticalAirflowOptions.find(
    (o) => o.id === state.swingVertical,
  );
  const horizontalOption = horizontalAirflowOptions.find(
    (o) => o.id === state.swingHorizontal,
  );
  const VerticalIcon = verticalOption?.icon;
  const HorizontalIcon = horizontalOption?.icon;

  return (
    <View style={styles.container}>
      {ModeIcon && (
        <View style={styles.pill}>
          <ModeIcon size={14} color={modeConfig?.color} />
          <Text style={styles.temperatureText}>{state.temperature} °C</Text>
        </View>
      )}

      <View style={styles.pill}>
        <Fan size={14} color={theme.accentGlow} />
        {state.fanSpeed === undefined || state.fanSpeed === 'auto' ? (
          <Text style={styles.pillText}>Auto</Text>
        ) : (
          <MaterialCommunityIcons
            color={theme.accent}
            name={`numeric-${state.fanSpeed}` as MaterialCommunityIconName}
            size={18}
            style={styles.numericIcon}
          />
        )}
      </View>

      <View style={styles.pill}>
        <View style={styles.verticalCompass}>
          <DraftingCompass color={theme.accentGlow} size={14} />
        </View>
        {VerticalIcon ? (
          <View
            style={{
              transform: [{ rotate: `${verticalOption?.iconRotation ?? 0}deg` }],
            }}
          >
            <VerticalIcon color={theme.accent} size={14} strokeWidth={2.2} />
          </View>
        ) : (
          <Text style={styles.pillText}>Auto</Text>
        )}
      </View>

      <View style={styles.pill}>
        <DraftingCompass color={theme.accentGlow} size={14} />
        {HorizontalIcon ? (
          <View
            style={{
              transform: [
                { rotate: `${horizontalOption?.iconRotation ?? 0}deg` },
              ],
            }}
          >
            <HorizontalIcon color={theme.accent} size={14} strokeWidth={2.2} />
          </View>
        ) : (
          <Text style={styles.pillText}>Auto</Text>
        )}
      </View>

      {state.powerful ? (
        <View style={styles.pill}>
          <Zap size={14} color={theme.powerfulAccent} />
        </View>
      ) : state.quiet ? (
        <View style={styles.pill}>
          <Moon size={14} color={theme.quietAccent} />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    pill: {
      alignItems: 'center',
      backgroundColor: theme.paperBackground,
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'center',
      minHeight: 28,
      paddingHorizontal: 8,
      paddingVertical: 4,
      width: 80
    },
    pillText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
    temperatureText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '600',
    },
    numericIcon: {
      marginTop: -1,
    },
    verticalCompass: {
      transform: [{ rotate: '-63.5deg' }, { translateX: 1 }],
    },
  });
