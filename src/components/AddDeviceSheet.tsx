import { AirVent, Lightbulb, Tv, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from 'react-native';
import { theme } from '../theme/theme';
import { AppButton } from './AppButton';

type DeviceType = 'ac' | 'tv' | 'light';
type DeviceBrand = 'panasonic' | 'lg';

type AddDeviceSheetProps = {
  visible: boolean;
  onClose: () => void;
  onContinue: (deviceType: DeviceType, brand: DeviceBrand) => void;
};

export function AddDeviceSheet({ visible, onClose, onContinue }: AddDeviceSheetProps) {
  const [selectedType, setSelectedType] = useState<DeviceType | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<DeviceBrand | null>(null);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);

  const deviceTypes: Array<{
    type: DeviceType;
    label: string;
    icon: typeof AirVent;
    enabled: boolean;
  }> = [
    { type: 'ac', label: 'Air Conditioner', icon: AirVent, enabled: true },
    { type: 'tv', label: 'TV', icon: Tv, enabled: false },
    { type: 'light', label: 'Lamp', icon: Lightbulb, enabled: false },
  ];

  const brands: Array<{
    brand: DeviceBrand;
    label: string;
    enabled: boolean;
  }> = [
    { brand: 'panasonic', label: 'Panasonic', enabled: true },
    { brand: 'lg', label: 'LG', enabled: false },
  ];

  const handleTypeSelect = (type: DeviceType, enabled: boolean) => {
    if (!enabled) return;
    setSelectedType(type);
    if (type === 'ac') {
      setSelectedBrand('panasonic');
    } else {
      setSelectedBrand(null);
    }
  };

  const handleBrandSelect = (brand: DeviceBrand, enabled: boolean) => {
    if (!enabled) return;
    setSelectedBrand(brand);
    setShowBrandDropdown(false);
  };

  const handleContinue = () => {
    if (selectedType && selectedBrand) {
      onContinue(selectedType, selectedBrand);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    setSelectedBrand(null);
    setShowBrandDropdown(false);
    onClose();
  };

  const canContinue = selectedType === 'ac' && selectedBrand === 'panasonic';
  const enabledBrand = brands.find((b) => b.brand === selectedBrand && b.enabled);
  const dropdownLabel = enabledBrand
    ? enabledBrand.label
    : 'Select Brand';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

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
                  {!enabled && (
                    <Text style={styles.comingSoon}>Coming soon</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {selectedType === 'ac' && (
              <>
                <Text style={[styles.sectionLabel, styles.sectionSpacing]}>
                  Brand
                </Text>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setShowBrandDropdown(!showBrandDropdown)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !selectedBrand && styles.dropdownPlaceholder,
                    ]}
                  >
                    {dropdownLabel}
                  </Text>
                  <ChevronDown size={20} color={theme.text} />
                </TouchableOpacity>

                {showBrandDropdown && (
                  <View style={styles.dropdownMenu}>
                    {brands.map(({ brand, label, enabled }) => (
                      <TouchableOpacity
                        key={brand}
                        style={[
                          styles.dropdownItem,
                          !enabled && styles.dropdownItemDisabled,
                        ]}
                        onPress={() => handleBrandSelect(brand, enabled)}
                        disabled={!enabled}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            !enabled && styles.dropdownItemTextDisabled,
                          ]}
                        >
                          {label}
                        </Text>
                        {!enabled && (
                          <Text style={styles.dropdownComingSoon}>
                            Coming soon
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <AppButton
              label="Continue"
              onPress={handleContinue}
              disabled={!canContinue}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.paperBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.text + '40',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: {
    padding: 24,
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
  dropdown: {
    backgroundColor: theme.surfaceLow,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.border,
  },
  dropdownText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  dropdownPlaceholder: {
    color: theme.textSecondary,
  },
  dropdownMenu: {
    backgroundColor: theme.surfaceLow,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemDisabled: {
    opacity: 0.5,
  },
  dropdownItemText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  dropdownItemTextDisabled: {
    color: theme.text + '60',
  },
  dropdownComingSoon: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
});
