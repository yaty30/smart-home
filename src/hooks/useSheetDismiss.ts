import { useCallback, useEffect, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

export function useSheetDismiss(
  translateY: Animated.Value,
  dismissRef: React.MutableRefObject<() => void>,
) {
  const scrollAtTop = useRef(true);

  const snapBack = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  }, [translateY]);

  const snapBackRef = useRef(snapBack);
  useEffect(() => {
    snapBackRef.current = snapBack;
  }, [snapBack]);

  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dy }) => {
        translateY.setValue(Math.max(0, dy));
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 120 || vy > 0.8) {
          dismissRef.current();
        } else {
          snapBackRef.current();
        }
      },
      onPanResponderTerminate: () => {
        snapBackRef.current();
      },
    }),
  ).current;

  const contentPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        scrollAtTop.current && dy > 10 && dy > Math.abs(dx),
      onPanResponderMove: (_, { dy }) => {
        translateY.setValue(Math.max(0, dy));
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 120 || vy > 0.8) {
          dismissRef.current();
        } else {
          snapBackRef.current();
        }
      },
      onPanResponderTerminate: () => {
        snapBackRef.current();
      },
    }),
  ).current;

  return { scrollAtTop, handlePan, contentPan };
}
