import { create } from 'zustand';
import type { AnalysisConfig } from '@gp16/shared';

interface ConfigState {
  config: Required<AnalysisConfig>;
  setConfig: (c: Partial<AnalysisConfig>) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: {
    electricityPricePerKwh: 0.85,
    fullLoadHoursPerYear: 1200,
    gridEmissionFactor: 0.55,
    performanceRatio: 0.8,
    pvUnitCostPerKw: 900,
    inverterUnitCostPerKw: 150,
    battUnitCostPerKwh: 400,
  },
  setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
}));
