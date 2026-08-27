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
  onPress?: () => void;
  onSwipeEnd?: () => void;
  onSwipeStart?: () => void;
  style?: ViewStyle | ViewStyle[];
  contentBackground?: string;
}>;

const SWIPE_THRESHOLD = -70;
const ACTION_BUTTON_WIDTH = 74;
const ACTION_BUTTON_GAP = theme.spacing.sm;
const ACTION_BUTTON_RADIUS = theme.radiusMedium;

export function SwipeableItem({
  children,
  onDelete,
  onRename,
  onPress,
  onSwipeEnd,
  onSwipeStart,
  style,
  contentBackground,
}: SwipeableItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const gestureStartTime = useRef(0);
  const gestureStartPos = useRef({ x: 0, y: 0 });
  const actionCount = onRename ? 2 : 1;
  const actionWidth =
    actionCount * ACTION_BUTTON_WIDTH +
    (onRename ? ACTION_BUTTON_GAP * 2 : 0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: (evt) => {
        gestureStartTime.current = Date.now();
        gestureStartPos.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
        translateX.setOffset(lastOffset.current);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Determine if this is a horizontal or vertical gesture
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);

        // If user is clearly scrolling vertically, release the gesture
        if (!isHorizontal && Math.abs(gestureState.dy) > 10) {
          return;
        }

        // Only call onSwipeStart when we're sure it's a horizontal swipe
        if (isHorizontal && Math.abs(gestureState.dx) > 5) {
          onSwipeStart?.();
        }

        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        } else if (lastOffset.current < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        translateX.flattenOffset();

        const gestureDuration = Date.now() - gestureStartTime.current;
        const totalMovement = Math.sqrt(gestureState.dx ** 2 + gestureState.dy ** 2);
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);

        // Detect tap: short duration, minimal movement
        if (gestureDuration < 200 && totalMovement < 10 && lastOffset.current === 0) {
          onPress?.();
          onSwipeEnd?.();
          return;
        }

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
          contentBackground ? { backgroundColor: contentBackground } : null,
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
