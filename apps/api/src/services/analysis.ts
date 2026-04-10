import type { Topology, AnalysisConfig, AnalysisResponse } from '@gp16/shared';

const DEFAULTS: Required<AnalysisConfig> = {
  electricityPricePerKwh: 0.85,
  fullLoadHoursPerYear: 1200,
  gridEmissionFactor: 0.55,
  performanceRatio: 0.8,
  pvUnitCostPerKw: 900,
  inverterUnitCostPerKw: 150,
  battUnitCostPerKwh: 400,
};

export function analyze(topology: Topology, cfg: AnalysisConfig = {}): AnalysisResponse {
  const c = { ...DEFAULTS, ...cfg };
  const nodes = topology.nodes ?? [];

  const pvKw = nodes
    .filter((n) => n.data.deviceType === 'pv_panel')
    .reduce((s, n) => s + (n.data.ratedPowerKw ?? 0), 0);

  const inverterKw = nodes
    .filter((n) => n.data.deviceType === 'inverter')
    .reduce((s, n) => s + (n.data.ratedPowerKw ?? 0), 0);

  const battKwh = nodes
    .filter((n) => n.data.deviceType === 'battery')
    .reduce((s, n) => s + (n.data.capacityKwh ?? 0), 0);

  const annualGenerationKwh = pvKw * c.fullLoadHoursPerYear * c.performanceRatio;
  const annualCo2SavedTons = (annualGenerationKwh * c.gridEmissionFactor) / 1000;
  const equivalentTrees = Math.round(annualCo2SavedTons * 50);

  const pvCapex = pvKw * c.pvUnitCostPerKw;
  const inverterCapex = inverterKw * c.inverterUnitCostPerKw;
  const battCapex = battKwh * c.battUnitCostPerKwh;
  const totalCapex = pvCapex + inverterCapex + battCapex;

  const annualSaving = annualGenerationKwh * c.electricityPricePerKwh;
  const simplePaybackYears = annualSaving > 0 ? totalCapex / annualSaving : null;

  const maintenancePerYear = pvKw * 20;
  const costSeries = Array.from({ length: 10 }, (_, i) => {
    const year = i + 1;
    return {
      year,
      traditionalCost: Math.round(year * annualSaving),
      schemeCost: Math.round(totalCapex + year * maintenancePerYear),
    };
  });

  return {
    summary: {
      pvInstalledKw: pvKw,
      inverterKw,
      battKwh,
      annualGenerationKwh,
      annualCo2SavedTons,
      equivalentTrees,
      totalCapex,
    },
    costSeries,
    simplePaybackYears,
  };
}
