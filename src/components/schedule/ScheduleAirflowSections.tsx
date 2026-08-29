import type { ScheduleAirflow, ScheduleFanSpeed } from "../../types/acSchedule";
import type { AirflowLevel, FanSpeed } from "../../types/airConditioner";
import {
  HorizontalAirflowSelector,
  VerticalAirflowSelector,
} from "../AirflowSelectors";
import { FanSpeedControl } from "../FanSpeedControl";
import { Section } from "../Section";

type ScheduleFanSpeedSectionProps = {
  fanSpeed: ScheduleFanSpeed | undefined;
  onChangeFanSpeed: (fanSpeed: ScheduleFanSpeed) => void;
};

export function ScheduleFanSpeedSection({
  fanSpeed,
  onChangeFanSpeed,
}: ScheduleFanSpeedSectionProps) {
  return (
    <Section>
      <FanSpeedControl
        isAuto={(fanSpeed ?? "auto") === "auto"}
        isPowered={true}
        onChangeAuto={(auto) => {
          if (!auto) return;
          onChangeFanSpeed("auto");
        }}
        onChangeSpeed={onChangeFanSpeed}
        speed={
          fanSpeed === undefined || fanSpeed === "auto"
            ? (3 as FanSpeed)
            : fanSpeed
        }
      />
    </Section>
  );
}

type ScheduleAirflowSectionProps = {
  airflow: ScheduleAirflow;
  onChangeAirflow: (airflow: ScheduleAirflow) => void;
};

export function ScheduleVerticalAirflowSection({
  airflow,
  onChangeAirflow,
}: ScheduleAirflowSectionProps) {
  return (
    <Section>
      <VerticalAirflowSelector
        selectedLevel={airflow === "auto" ? "one" : airflow}
        isAuto={airflow === "auto"}
        isPowered={true}
        onChangeAuto={(auto) => onChangeAirflow(auto ? "auto" : "one")}
        onChangeLevel={(level) => onChangeAirflow(level as AirflowLevel)}
      />
    </Section>
  );
}

export function ScheduleHorizontalAirflowSection({
  airflow,
  onChangeAirflow,
}: ScheduleAirflowSectionProps) {
  return (
    <Section>
      <HorizontalAirflowSelector
        selectedLevel={airflow === "auto" ? "one" : airflow}
        isAuto={airflow === "auto"}
        isPowered={true}
        onChangeAuto={(auto) => onChangeAirflow(auto ? "auto" : "one")}
        onChangeLevel={(level) => onChangeAirflow(level as AirflowLevel)}
      />
    </Section>
  );
}
