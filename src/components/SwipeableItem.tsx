import { Pencil, Trash2 } from 'lucide-react-native';
import type { PropsWithChildren } from 'react';
import { useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { theme } from '../theme/theme';

type SwipeableItemProps = PropsWithChildren<{
  onDelete: () => void;
  onRename?: () => void;
  onSwipeEnd?: () => void;
  onSwipeStart?: () => void;
  style?: ViewStyle | ViewStyle[];
}>;

const SWIPE_THRESHOLD = -70;
const ACTION_BUTTON_WIDTH = 74;
const ACTION_BUTTON_GAP = theme.spacing.sm;
const ACTION_BUTTON_RADIUS = theme.radiusMedium;

export function SwipeableItem({
  children,
  onDelete,
  onRename,
  onSwipeEnd,
  onSwipeStart,
  style,
}: SwipeableItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const actionCount = onRename ? 2 : 1;
  const actionWidth =
    actionCount * ACTION_BUTTON_WIDTH +
    (onRename ? ACTION_BUTTON_GAP * 2 : 0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        onSwipeStart?.();
        translateX.setOffset(lastOffset.current);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        } else if (lastOffset.current < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();

        const currentValue = gestureState.dx + lastOffset.current;

        if (currentValue < SWIPE_THRESHOLD) {
          lastOffset.current = -actionWidth;
          Animated.spring(translateX, {
            toValue: -actionWidth,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        } else {
          lastOffset.current = 0;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
        onSwipeEnd?.();
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        lastOffset.current = 0;
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
        onSwipeEnd?.();
      },
    })
  ).current;

  const handleAction = (action: () => void) => {
    lastOffset.current = 0;
    Animated.timing(translateX, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      action();
    });
  };

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.actionButtonContainer,
          onRename && styles.actionButtonContainerWithRename,
          { width: actionWidth },
        ]}
      >
        {onRename ? (
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Rename"
            onPress={() => handleAction(onRename)}
            style={[styles.actionButton, styles.renameButton]}
          >
            <Pencil color={theme.text} size={20} strokeWidth={2.4} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Delete"
          onPress={() => handleAction(onDelete)}
          style={[styles.actionButton, styles.deleteButton]}
        >
          <Trash2 color={theme.text} size={20} strokeWidth={2.4} />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.swipeableContent,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  actionButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: ACTION_BUTTON_GAP,
  },
  actionButtonContainerWithRename: {
    paddingLeft: ACTION_BUTTON_GAP,
  },
  actionButton: {
    width: ACTION_BUTTON_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: ACTION_BUTTON_RADIUS,
  },
  renameButton: {
    backgroundColor: theme.accent,
  },
  deleteButton: {
    backgroundColor: theme.powerAccent,
  },
  swipeableContent: {
    backgroundColor: theme.root,
  },
});
