export type DeviceType = 'pv_panel' | 'inverter' | 'battery' | 'charger' | 'load' | 'grid';

export interface TopologyNode {
  id: string;
  position: { x: number; y: number };
  data: {
    label: string;
    deviceType: DeviceType;
    ratedPowerKw?: number;
    capacityKwh?: number;
  };
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
}

export interface Topology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface AnalysisConfig {
  electricityPricePerKwh?: number;
  fullLoadHoursPerYear?: number;
  gridEmissionFactor?: number;
  performanceRatio?: number;
  pvUnitCostPerKw?: number;
  inverterUnitCostPerKw?: number;
  battUnitCostPerKwh?: number;
}

export interface AnalysisSummary {
  pvInstalledKw: number;
  inverterKw: number;
  battKwh: number;
  annualGenerationKwh: number;
  annualCo2SavedTons: number;
  equivalentTrees: number;
  totalCapex: number;
}

export interface CostPoint {
  year: number;
  traditionalCost: number;
  schemeCost: number;
}

export interface AnalysisResponse {
  summary: AnalysisSummary;
  costSeries: CostPoint[];
  simplePaybackYears: number | null;
}

export interface AILayoutResult {
  layoutVersion: string;
  topology: Topology;
  assumptions: string[];
}

export interface SavedTopology {
  id: string;
  name: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  createdAt: string;
  updatedAt: string;
}
