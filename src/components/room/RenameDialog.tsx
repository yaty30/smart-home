import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { type Theme, useTheme } from '../../theme/theme';

type RenameDialogProps = {
  visible: boolean;
  title: string;
  label: string;
  placeholder: string;
  saveAccessibilityLabel: string;
  value: string;
  onChangeValue: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

/** Modal used to rename a room or one of its devices. */
export function RenameDialog({
  label,
  onCancel,
  onChangeValue,
  onSubmit,
  placeholder,
  saveAccessibilityLabel,
  title,
  value,
  visible,
}: RenameDialogProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isEmpty = value.trim().length === 0;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <Pressable style={styles.renameBackdrop} onPress={onCancel}>
        <Pressable style={styles.renameDialog} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.renameTitle}>{title}</Text>
          <Text style={styles.renameLabel}>{label}</Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={onChangeValue}
            onSubmitEditing={onSubmit}
            placeholder={placeholder}
            placeholderTextColor={theme.textMuted}
            returnKeyType="done"
            style={styles.renameInput}
            value={value}
          />
          <View style={styles.renameActions}>
            <TouchableOpacity
              activeOpacity={0.74}
              accessibilityRole="button"
              accessibilityLabel="Cancel rename"
              onPress={onCancel}
              style={styles.renameSecondaryButton}
            >
              <Text style={styles.renameSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.74}
              accessibilityRole="button"
              accessibilityLabel={saveAccessibilityLabel}
              disabled={isEmpty}
              onPress={onSubmit}
              style={[
                styles.renamePrimaryButton,
                isEmpty && styles.renameButtonDisabled,
              ]}
            >
              <Text style={styles.renamePrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  renameBackdrop: {
    alignItems: 'center',
    backgroundColor: theme.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  renameDialog: {
    backgroundColor: theme.paperBackground,
    borderColor: theme.border,
    borderRadius: theme.radiusMedium,
    borderWidth: 1,
    maxWidth: 420,
    padding: theme.spacing.xl,
    width: '100%',
  },
  renameTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: theme.spacing.xl,
  },
  renameLabel: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },
  renameInput: {
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
  renameActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
    marginTop: theme.spacing.xl,
  },
  renameSecondaryButton: {
    alignItems: 'center',
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  renameSecondaryText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  renamePrimaryButton: {
    alignItems: 'center',
    backgroundColor: theme.accent,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  renameButtonDisabled: {
    opacity: 0.45,
  },
  renamePrimaryText: {
    color: theme.textOnAccent,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
