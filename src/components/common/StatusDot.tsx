import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/theme';

type StatusDotProps = {
  online: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function StatusDot({ online, size = 8, style }: StatusDotProps) {
  const theme = useTheme();
  const styles = createStyles(size);

  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: online ? theme.statusColors.online : theme.textMuted },
        style,
      ]}
    />
  );
}

const createStyles = (size: number) =>
  StyleSheet.create({
    dot: {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
  });
