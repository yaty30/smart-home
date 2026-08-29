import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { type Theme, useTheme } from "../../theme/theme";
import type { AirflowLevel, FanSpeed } from "../../types/airConditioner";
import {
  HorizontalAirflowSelector,
  VerticalAirflowSelector,
} from "../AirflowSelectors";
import { CollapsibleView } from "../CollapsibleView";
import { FanSpeedControl } from "../FanSpeedControl";
import { Section } from "../Section";

type AcLiveControlsProps = {
  power: boolean;
  canControlDevice: boolean;
  fanSpeed: FanSpeed;
  fanAuto: boolean;
  horizontalAirflow: AirflowLevel;
  horizontalAirflowAuto: boolean;
  verticalAirflow: AirflowLevel;
  verticalAirflowAuto: boolean;
  onChangeFanSpeed: (speed: FanSpeed) => void;
  onChangeFanAuto: (auto: boolean) => void;
  onChangeHorizontalAirflow: (level: AirflowLevel) => void;
  onChangeHorizontalAirflowAuto: (auto: boolean) => void;
  onChangeVerticalAirflow: (level: AirflowLevel) => void;
  onChangeVerticalAirflowAuto: (auto: boolean) => void;
};

export function AcLiveControls({
  power,
  canControlDevice,
  fanSpeed,
  fanAuto,
  horizontalAirflow,
  horizontalAirflowAuto,
  verticalAirflow,
  verticalAirflowAuto,
  onChangeFanSpeed,
  onChangeFanAuto,
  onChangeHorizontalAirflow,
  onChangeHorizontalAirflowAuto,
  onChangeVerticalAirflow,
  onChangeVerticalAirflowAuto,
}: AcLiveControlsProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <CollapsibleView visible={power}>
      <View style={styles.liveControlSections}>
        <Section>
          <FanSpeedControl
            isAuto={fanAuto}
            isDisabled={!canControlDevice}
            isPowered={power}
            onChangeAuto={onChangeFanAuto}
            onChangeSpeed={onChangeFanSpeed}
            speed={fanSpeed}
          />
        </Section>

        <Section style={styles.airflowCard}>
          <HorizontalAirflowSelector
            isAuto={horizontalAirflowAuto}
            isDisabled={!canControlDevice}
            isPowered={power}
            onChangeAuto={onChangeHorizontalAirflowAuto}
            onChangeLevel={onChangeHorizontalAirflow}
            selectedLevel={horizontalAirflow}
          />
          <VerticalAirflowSelector
            isAuto={verticalAirflowAuto}
            isDisabled={!canControlDevice}
            isPowered={power}
            onChangeAuto={onChangeVerticalAirflowAuto}
            onChangeLevel={onChangeVerticalAirflow}
            selectedLevel={verticalAirflow}
          />
        </Section>
      </View>
    </CollapsibleView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    airflowCard: {
      gap: theme.spacing.lg,
    },
    liveControlSections: {
      gap: theme.spacing.md,
    },
  });
