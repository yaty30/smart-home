import { Picker } from '@react-native-picker/picker';
import { AirVent, Lightbulb, Tv } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../theme/theme';
import { AppButton } from './AppButton';

type DeviceType = 'ac' | 'tv' | 'light';
type DeviceBrand =
  | 'panasonic' | 'lg' | 'mitsubishi' | 'hitachi'
  | 'toshiba' | 'sharp' | 'fujitsu' | 'samsung' | 'midea';

type AddDeviceSheetProps = {
  visible: boolean;
  onClose: () => void;
  onContinue: (deviceType: DeviceType, brand: DeviceBrand) => void;
};

// Large enough to clear any device screen during enter/exit animations.
const OFFSCREEN = 800;

export function AddDeviceSheet({ visible, onClose, onContinue }: AddDeviceSheetProps) {
  const [selectedType, setSelectedType] = useState<DeviceType | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<DeviceBrand | null>(null);
  // Start off-screen; we animate in ourselves so animationType="none" on the Modal.
  // useNativeDriver: false keeps JS-side hit testing in sync with the visual position.
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const isDismissing = useRef(false);

  const deviceTypes = [
    { type: 'ac' as DeviceType, label: 'Air Conditioner', icon: AirVent, enabled: true },
    { type: 'tv' as DeviceType, label: 'TV', icon: Tv, enabled: false },
    { type: 'light' as DeviceType, label: 'Lamp', icon: Lightbulb, enabled: false },
  ];

  const brands = [
    { brand: 'panasonic' as DeviceBrand, label: 'Panasonic' },
    { brand: 'lg' as DeviceBrand, label: 'LG' },
    { brand: 'mitsubishi' as DeviceBrand, label: 'Mitsubishi Electric' },
    { brand: 'hitachi' as DeviceBrand, label: 'Hitachi' },
    { brand: 'toshiba' as DeviceBrand, label: 'Toshiba' },
    { brand: 'sharp' as DeviceBrand, label: 'Sharp' },
    { brand: 'fujitsu' as DeviceBrand, label: 'Fujitsu' },
    { brand: 'samsung' as DeviceBrand, label: 'Samsung' },
    { brand: 'midea' as DeviceBrand, label: 'Midea' },
  ];

  // Reset position each time the sheet opens so a partial drag from a previous
  // session doesn't leave the view in a wrong position.
  useEffect(() => {
    if (visible) {
      isDismissing.current = false;
      translateY.setValue(OFFSCREEN);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 4,
        speed: 14,
      }).start();
    }
  }, [visible, translateY]);

  const handleClose = useCallback(() => {
    setSelectedType(null);
    setSelectedBrand(null);
    onClose();
  }, [onClose]);

  // Stable ref so the PanResponder (created once) always calls the latest handleClose.
  const handleCloseRef = useRef(handleClose);
  useEffect(() => { handleCloseRef.current = handleClose; }, [handleClose]);

  const snapBack = useCallback(() => {
    if (isDismissing.current) return;
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  }, [translateY]);

  const dismiss = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    Animated.timing(translateY, {
      toValue: OFFSCREEN,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      handleCloseRef.current();
    });
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dy }) => {
        // setValue is always synchronous JS — no native driver concern here.
        translateY.setValue(Math.max(0, dy));
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 120 || vy > 0.8) {
          dismiss();
        } else {
          snapBack();
        }
      },
      onPanResponderTerminate: () => { snapBack(); },
    }),
  ).current;

  const handleTypeSelect = (type: DeviceType, enabled: boolean) => {
    if (!enabled) return;
    setSelectedType(type);
    setSelectedBrand(type === 'ac' ? 'panasonic' : null);
  };

  const handleContinue = () => {
    if (selectedType && selectedBrand) {
      onContinue(selectedType, selectedBrand);
      handleClose();
    }
  };

  const canContinue = selectedType === 'ac' && selectedBrand != null;

  return (
    // animationType="slide" lets iOS handle the entrance natively.
    // The sheet view starts at translateY=0, so hit testing is immediately correct.
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <View style={styles.root}>
        {/* Backdrop — tap to close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          activeOpacity={1}
        />

        {/* Positioning wrapper — box-none so it doesn't absorb backdrop taps */}
        <View style={styles.positioner} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            {/* Handle area — sole PanResponder owner. No Pressable in this subtree. */}
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Add Device</Text>

              <Text style={styles.sectionLabel}>Device Type</Text>
              <View style={styles.grid}>
                {deviceTypes.map(({ type, label, icon: Icon, enabled }) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeCard,
                      selectedType === type && styles.typeCardSelected,
                      !enabled && styles.typeCardDisabled,
                    ]}
                    onPress={() => handleTypeSelect(type, enabled)}
                    disabled={!enabled}
                    activeOpacity={0.7}
                  >
                    <Icon
                      size={32}
                      color={
                        !enabled
                          ? theme.text + '40'
                          : selectedType === type
                            ? theme.accent
                            : theme.text
                      }
                    />
                    <Text
                      style={[
                        styles.typeLabel,
                        !enabled && styles.typeLabelDisabled,
                        selectedType === type && styles.typeLabelSelected,
                      ]}
                    >
                      {label}
                    </Text>
                    {!enabled && <Text style={styles.comingSoon}>Coming soon</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              {selectedType === 'ac' && (
                <>
                  <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Brand</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedBrand ?? brands[0]?.brand ?? 'panasonic'}
                      onValueChange={(value) => setSelectedBrand(value as DeviceBrand)}
                      style={styles.picker}
                      itemStyle={styles.pickerItem}
                    >
                      {brands.map((b) => (
                        <Picker.Item key={b.brand} label={b.label} value={b.brand} />
                      ))}
                    </Picker>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <AppButton label="Continue" onPress={handleContinue} disabled={!canContinue} />
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  positioner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.paperBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  handleArea: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.text + '40',
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSpacing: {
    marginTop: 24,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    backgroundColor: theme.surfaceLow,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardSelected: {
    borderColor: theme.accent,
    backgroundColor: theme.accentMuted,
  },
  typeCardDisabled: {
    opacity: 0.5,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginTop: 8,
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: theme.accent,
  },
  typeLabelDisabled: {
    color: theme.text + '60',
  },
  comingSoon: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 4,
  },
  pickerWrapper: {
    backgroundColor: theme.surfaceLow,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    marginBottom: 24,
  },
  picker: {
    width: '100%',
  },
  pickerItem: {
    color: theme.text,
    fontSize: 16,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
});
