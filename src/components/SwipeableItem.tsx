import { Trash2 } from 'lucide-react-native';
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
  style?: ViewStyle | ViewStyle[];
}>;

const SWIPE_THRESHOLD = -80;
const DELETE_BUTTON_WIDTH = 80;

export function SwipeableItem({ children, onDelete, style }: SwipeableItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
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
          lastOffset.current = -DELETE_BUTTON_WIDTH;
          Animated.spring(translateX, {
            toValue: -DELETE_BUTTON_WIDTH,
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
      },
    })
  ).current;

  const handleDelete = () => {
    lastOffset.current = 0;
    Animated.timing(translateX, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDelete();
    });
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.deleteButtonContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleDelete}
          style={styles.deleteButton}
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
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_BUTTON_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: theme.powerAccent,
    width: DELETE_BUTTON_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeableContent: {
    backgroundColor: theme.root,
  },
});
