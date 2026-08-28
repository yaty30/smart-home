import { useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { BOTTOM_NAV_CLEARANCE } from '../components/BottomNav';
import type {
  RootStackNavigationProp,
  RootStackParamList,
} from '../navigation/types';

const BOTTOM_NAV_ANIMATION_MS = 260;
const BOTTOM_NAV_HIDDEN_OFFSET = BOTTOM_NAV_CLEARANCE + 48;

type UseBottomNavAnimationOptions<T extends keyof RootStackParamList> = {
  navigation: RootStackNavigationProp<T>;
  hiddenOffset?: number;
};

export function useBottomNavAnimation<T extends keyof RootStackParamList>({
  navigation,
  hiddenOffset = BOTTOM_NAV_HIDDEN_OFFSET,
}: UseBottomNavAnimationOptions<T>) {
  const bottomNavTranslateY = useRef(new Animated.Value(hiddenOffset)).current;
  const bottomNavOpacity = useRef(new Animated.Value(0)).current;
  const isLeavingScreen = useRef(false);

  const animateBottomNavIn = useCallback(() => {
    bottomNavTranslateY.stopAnimation();
    bottomNavOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(bottomNavTranslateY, {
        duration: BOTTOM_NAV_ANIMATION_MS,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(bottomNavOpacity, {
        duration: BOTTOM_NAV_ANIMATION_MS,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bottomNavOpacity, bottomNavTranslateY]);

  const animateBottomNavOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(bottomNavTranslateY, {
        duration: 220,
        toValue: hiddenOffset,
        useNativeDriver: true,
      }),
      Animated.timing(bottomNavOpacity, {
        duration: 180,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bottomNavOpacity, bottomNavTranslateY, hiddenOffset]);

  // Paint the screen with the nav below the viewport first, then slide it in.
  useEffect(() => {
    const frame = requestAnimationFrame(animateBottomNavIn);

    return () => {
      cancelAnimationFrame(frame);
      bottomNavTranslateY.stopAnimation();
      bottomNavOpacity.stopAnimation();
    };
  }, [animateBottomNavIn, bottomNavOpacity, bottomNavTranslateY]);

  // React Navigation owns swipe-back gestures, so the normal header back handler
  // is not called when the user swipes. Listen to the navigator transition and
  // animate the custom bottom nav independently.
  useEffect(() => {
    const unsubscribeTransitionStart = navigation.addListener(
      'transitionStart',
      (event) => {
        if (!event.data.closing) {
          return;
        }

        animateBottomNavOut();
      },
    );

    // Native-stack emits this on iOS when the interactive back gesture is
    // abandoned. Restore the nav because the screen remains visible.
    const unsubscribeGestureCancel = navigation.addListener(
      'gestureCancel',
      () => {
        if (!isLeavingScreen.current) {
          animateBottomNavIn();
        }
      },
    );

    return () => {
      unsubscribeTransitionStart();
      unsubscribeGestureCancel();
    };
  }, [animateBottomNavIn, animateBottomNavOut, navigation]);

  return {
    bottomNavTranslateY,
    bottomNavOpacity,
    animateBottomNavIn,
    animateBottomNavOut,
    isLeavingScreen,
  };
}
