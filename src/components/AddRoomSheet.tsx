import { useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ROOM_ICONS, DEFAULT_ROOM_ICON, type RoomIcon } from '../domain/roomIcon';
import { theme } from '../theme/theme';
import { AppButton } from './AppButton';

type AddRoomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onAddRoom: (name: string, icon: RoomIcon) => void;
};

export function AddRoomSheet({ visible, onClose, onAddRoom }: AddRoomSheetProps) {
  const [roomName, setRoomName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<RoomIcon>(DEFAULT_ROOM_ICON);

  const canAddRoom = roomName.trim().length > 0;

  const handleClose = () => {
    Keyboard.dismiss();
    setRoomName('');
    setSelectedIcon(DEFAULT_ROOM_ICON);
    onClose();
  };

  const handleSubmit = () => {
    const trimmedName = roomName.trim();
    if (!trimmedName) {
      return;
    }

    Keyboard.dismiss();
    onAddRoom(trimmedName, selectedIcon);
    setRoomName('');
    setSelectedIcon(DEFAULT_ROOM_ICON);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 70 || gestureState.vy > 0.8) {
          handleClose();
        }
      },
    }),
  ).current;

  const iconOptions = useMemo(() => ROOM_ICONS, []);

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleClose}
      transparent
      visible={visible}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={styles.keyboardAvoiding}
        >
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <SafeAreaView style={styles.sheetSafeArea}>
              <View
                accessibilityRole="button"
                accessibilityLabel="Dismiss add room sheet"
                style={styles.handleArea}
                {...panResponder.panHandlers}
              >
                <View style={styles.handle} />
              </View>

              <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.formScroll}
              >
                <Text style={styles.title}>Add Room</Text>

                <Text style={styles.sectionLabel}>Room Name</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  onChangeText={setRoomName}
                  onSubmitEditing={handleSubmit}
                  placeholder="Living Room"
                  placeholderTextColor={theme.textMuted}
                  returnKeyType="done"
                  style={styles.input}
                  value={roomName}
                />

                <Text style={[styles.sectionLabel, styles.iconSectionLabel]}>
                  Choose Icon
                </Text>
                <View style={styles.iconGrid}>
                  {iconOptions.map(({ id, label, icon: Icon }) => {
                    const isSelected = selectedIcon === id;

                    return (
                      <TouchableOpacity
                        key={id}
                        activeOpacity={0.74}
                        accessibilityLabel={`Select ${label} icon`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          Keyboard.dismiss();
                          setSelectedIcon(id);
                        }}
                        style={[
                          styles.iconOption,
                          isSelected && styles.iconOptionSelected,
                        ]}
                      >
                        <Icon
                          color={isSelected ? theme.accent : theme.textSecondary}
                          size={26}
                          strokeWidth={2.25}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.iconLabel,
                            isSelected && styles.iconLabelSelected,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <AppButton
                  disabled={!canAddRoom}
                  label="Add Room"
                  onPress={handleSubmit}
                  vibe="strong"
                />
              </View>
            </SafeAreaView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: theme.scrim,
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardAvoiding: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
  },
  sheet: {
    backgroundColor: theme.paperBackground,
    borderColor: theme.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '86%',
    overflow: 'hidden',
  },
  sheetSafeArea: {
    maxHeight: '100%',
  },
  formScroll: {
    flexShrink: 1,
  },
  handleArea: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
  },
  handle: {
    backgroundColor: theme.textMuted,
    borderRadius: 2,
    height: 4,
    width: 42,
  },
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  title: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    height: 54,
    paddingHorizontal: theme.spacing.lg,
  },
  iconSectionLabel: {
    marginTop: theme.spacing.xl,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  iconOption: {
    alignItems: 'center',
    backgroundColor: theme.surfaceLow,
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: theme.spacing.xs,
    height: 78,
    justifyContent: 'center',
    width: '23%',
  },
  iconOptionSelected: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.borderActive,
  },
  iconLabel: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    maxWidth: '86%',
    textAlign: 'center',
  },
  iconLabelSelected: {
    color: theme.accent,
  },
  footer: {
    borderTopColor: theme.border,
    borderTopWidth: 1,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
});
