import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native';
import { theme } from '../theme/theme';

export type PopupMenuItem = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type PopupMenuProps = {
  items: PopupMenuItem[];
  onRequestClose: () => void;
  panelStyle?: ViewStyle | ViewStyle[];
  visible: boolean;
};

const MENU_ANIMATION_MS = 160;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PopupMenu({
  items,
  onRequestClose,
  panelStyle,
  visible,
}: PopupMenuProps) {
  const [shouldRender, setShouldRender] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(progress, {
        duration: MENU_ANIMATION_MS,
        toValue: 1,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!shouldRender) {
      return;
    }

    Animated.timing(progress, {
      duration: MENU_ANIMATION_MS,
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShouldRender(false);
      }
    });
  }, [progress, shouldRender, visible]);

  if (!shouldRender) {
    return null;
  }

  const opacity = progress;
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });

  return (
    <Pressable style={styles.backdrop} onPress={onRequestClose}>
      <AnimatedPressable
        onPress={(event) => event.stopPropagation()}
        style={[
          styles.panel,
          panelStyle,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        {items.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            activeOpacity={0.74}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.onPress}
            style={[
              styles.item,
              index > 0 && styles.itemBorder,
              item.destructive && styles.itemDanger,
            ]}
          >
            <Text
              style={[
                styles.itemText,
                item.destructive && styles.itemTextDanger,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </AnimatedPressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  panel: {
    backgroundColor: theme.paperBackgroundElevated,
    borderColor: theme.border,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 12,
    minWidth: 190,
    overflow: 'hidden',
    position: 'absolute',
  },
  item: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
  },
  itemBorder: {
    borderTopColor: theme.border,
    borderTopWidth: 1,
  },
  itemDanger: {
    borderTopColor: theme.border,
  },
  itemText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  itemTextDanger: {
    color: theme.powerAccent,
  },
});
