import { Fan, DraftingCompass, Moon, Zap } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, type Theme } from '../theme/theme';
import { MODE_ICONS } from '../constants/acModes';
import {
  horizontalAirflowOptions,
  verticalAirflowOptions,
} from './AirflowSelectors';

type AcState = {
  mode?: string;
  temperature?: number;
  fanSpeed?: string | number;
  swingVertical?: string;
  swingHorizontal?: string;
  quiet?: boolean;
  powerful?: boolean;
};

type AcStatePillsProps = {
  state: AcState;
  compact?: boolean;
};

export function AcStatePills({ state, compact = false }: AcStatePillsProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const modeIcons = useMemo(() => MODE_ICONS(theme), [theme]);

  const modeConfig = state.mode ? modeIcons[state.mode as keyof typeof modeIcons] : null;
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
      {/* Mode + Temperature */}
      {ModeIcon && state.temperature !== undefined && (
        <View style={styles.pill}>
          <ModeIcon size={14} color={modeConfig?.color} />
          <Text style={styles.pillText}>{state.temperature}°C</Text>
        </View>
      )}

      {/* Fan Speed */}
      <View style={styles.pill}>
        <Fan size={14} color={theme.accentGlow} />
        {state.fanSpeed === undefined || state.fanSpeed === 'auto' ? (
          <Text style={styles.pillText}>Auto</Text>
        ) : (
          <MaterialCommunityIcons
            color={theme.accent}
            name={`numeric-${state.fanSpeed}` as any}
            size={18}
            style={{ marginTop: -1 }}
          />
        )}
      </View>

      {/* Vertical Airflow */}
      {!compact && (
        <View style={styles.pill}>
          <View style={{ transform: [{ rotate: '-63.5deg' }, { translateX: 1 }] }}>
            <DraftingCompass color={theme.accentGlow} size={14} />
          </View>
          {VerticalIcon ? (
            <View
              style={{
                transform: [
                  { rotate: `${verticalOption?.iconRotation ?? 0}deg` },
                ],
              }}
            >
              <VerticalIcon
                color={theme.accent}
                size={14}
                strokeWidth={2.2}
              />
            </View>
          ) : (
            <Text style={styles.pillText}>Auto</Text>
          )}
        </View>
      )}

      {/* Horizontal Airflow */}
      {!compact && (
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
              <HorizontalIcon
                color={theme.accent}
                size={14}
                strokeWidth={2.2}
              />
            </View>
          ) : (
            <Text style={styles.pillText}>Auto</Text>
          )}
        </View>
      )}

      {/* Quiet / Powerful */}
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
    },
    pillText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
  });
