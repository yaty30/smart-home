import { useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { type Theme, useTheme } from '../theme/theme';
import type { RootStackScreenProps } from '../navigation/types';

type PairControllerScreenProps = RootStackScreenProps<'PairController'>;

export function PairControllerScreen({ navigation }: PairControllerScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Add Controller</Text>
        <Text style={styles.body}>
          Controller pairing is not available in this version.
        </Text>
        <AppButton
          label="Back"
          onPress={handleBack}
          variant="secondary"
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      backgroundColor: theme.root,
      flex: 1,
    },
    container: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    title: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: 0,
      textAlign: 'center',
    },
    body: {
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: 0,
      textAlign: 'center',
      lineHeight: 22,
    },
    button: {
      marginTop: theme.spacing.md,
    },
  });
