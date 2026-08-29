import { useCallback, useEffect, useRef } from "react";
import { Animated } from "react-native";

const SHEET_OFFSCREEN = 800;
const SHEET_DISMISS_OFFSET = 900;
const OPEN_DURATION_MS = 320;
const CLOSE_DURATION_MS = 260;

type SheetAnimationOptions = {
  // The list sheet re-opens from the bottom edge; the editor animates from
  // wherever its previous dismissal left it.
  resetOnOpen?: boolean;
};

/**
 * Slide-up/slide-down animation shared by the schedule sheets. `onClose` is read
 * through a ref so the returned `close` stays stable across renders.
 */
export function useSheetAnimation(
  open: boolean,
  onClose: () => void,
  { resetOnOpen = false }: SheetAnimationOptions = {},
) {
  const translateY = useRef(new Animated.Value(SHEET_OFFSCREEN)).current;
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    if (resetOnOpen) {
      translateY.setValue(SHEET_OFFSCREEN);
    }

    Animated.timing(translateY, {
      toValue: 0,
      duration: OPEN_DURATION_MS,
      useNativeDriver: false,
    }).start();
  }, [open, resetOnOpen, translateY]);

  const close = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SHEET_DISMISS_OFFSET,
      duration: CLOSE_DURATION_MS,
      useNativeDriver: false,
    }).start(() => onCloseRef.current());
  }, [translateY]);

  return { translateY, close };
}
