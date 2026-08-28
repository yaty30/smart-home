import { useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';

const BOTTOM_NAV_ANIMATION_MS = 260;
const BOTTOM_NAV_HIDDEN_OFFSET_BASE = 108; // BOTTOM_NAV_CLEARANCE + 48

type UseBottomNavAnimationOptions = {
  navigation: NavigationProp<any>;
  hiddenOffset?: number;
};

export function useBottomNavAnimation({
  navigation,
  hiddenOffset = BOTTOM_NAV_HIDDEN_OFFSET_BASE,
}: UseBottomNavAnimationOptions) {
  const bottomNavTranslateY = useRef(
    new Animated.Value(hiddenOffset),
  ).current;
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

  useEffect(() => {
    const frame = requestAnimationFrame(animateBottomNavIn);

    return () => {
      cancelAnimationFrame(frame);
      bottomNavTranslateY.stopAnimation();
      bottomNavOpacity.stopAnimation();
    };
  }, [animateBottomNavIn, bottomNavOpacity, bottomNavTranslateY]);

  useEffect(() => {
    const addNavigationListener = navigation.addListener as unknown as (
      eventName: 'transitionStart' | 'gestureCancel',
      listener: (event: { data?: { closing?: boolean } }) => void,
    ) => () => void;

    const unsubscribeTransitionStart = addNavigationListener(
      'transitionStart',
      (event) => {
        if (!event.data?.closing) {
          return;
        }

        animateBottomNavOut();
      },
    );

    const unsubscribeGestureCancel = addNavigationListener(
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

  const handleBackPress = useCallback(() => {
    if (isLeavingScreen.current) {
      return;
    }

    isLeavingScreen.current = true;
    animateBottomNavOut();
  }, [animateBottomNavOut]);

  return {
    bottomNavTranslateY,
    bottomNavOpacity,
    animateBottomNavIn,
    animateBottomNavOut,
    handleBackPress,
    isLeavingScreen,
  };
}
