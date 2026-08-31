import { useCallback, useEffect, useRef, useState } from "react";

import { useDeviceConnection } from "../context/DeviceConnectionContext";
import {
  getAcPresets,
  removeAcPresets,
  saveAcPresets,
} from "../storage/acPresetStorage";
import { MAX_AC_PRESETS, type AcPreset } from "../types/acPreset";

export function useAcPresets() {
  const { pairedDevice } = useDeviceConnection();
  const [presets, setPresets] = useState<AcPreset[]>([]);
  const [isPresetLoading, setIsPresetLoading] = useState(false);
  const mutationVersion = useRef(0);

  const deviceKey =
    pairedDevice === null ? null : `${pairedDevice.host}|${pairedDevice.token}`;

  useEffect(() => {
    if (pairedDevice === null) {
      setPresets([]);
      setIsPresetLoading(false);
      return;
    }

    let cancelled = false;
    const loadVersion = mutationVersion.current;
    setIsPresetLoading(true);

    void getAcPresets(pairedDevice)
      .then((storedPresets) => {
        if (cancelled || mutationVersion.current !== loadVersion) return;
        setPresets(storedPresets);
      })
      .catch(() => {
        if (cancelled || mutationVersion.current !== loadVersion) return;
        setPresets([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsPresetLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deviceKey, pairedDevice]);

  const savePreset = useCallback(
    async (nextPreset: AcPreset) => {
      if (pairedDevice === null) {
        throw new Error("No paired device available for preset");
      }

      mutationVersion.current += 1;
      const normalizedPreset = {
        ...nextPreset,
        name: nextPreset.name.trim(),
      };
      const exists = presets.some((preset) => preset.id === nextPreset.id);
      const nextPresets = exists
        ? presets.map((preset) =>
            preset.id === nextPreset.id ? normalizedPreset : preset,
          )
        : presets.length >= MAX_AC_PRESETS
          ? presets
          : [...presets, normalizedPreset];

      if (!exists && presets.length >= MAX_AC_PRESETS) {
        throw new Error(`A maximum of ${MAX_AC_PRESETS} presets is allowed`);
      }

      await saveAcPresets(pairedDevice, nextPresets);
      setPresets(nextPresets);
    },
    [pairedDevice, presets],
  );

  const deletePreset = useCallback(
    async (id: string) => {
      if (pairedDevice === null) {
        return;
      }

      const nextPresets = presets.filter((preset) => preset.id !== id);
      if (nextPresets.length === presets.length) return;

      mutationVersion.current += 1;

      if (nextPresets.length === 0) {
        await removeAcPresets(pairedDevice);
        setPresets([]);
        return;
      }

      await saveAcPresets(pairedDevice, nextPresets);
      setPresets(nextPresets);
    },
    [pairedDevice, presets],
  );

  return {
    deletePreset,
    isPresetLoading,
    presets,
    savePreset,
  };
}
