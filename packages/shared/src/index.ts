export type DeviceType = 'pv_panel' | 'inverter' | 'battery' | 'charger' | 'load' | 'grid';

export interface TopologyNode {
  id: string;
  position: { x: number; y: number };
  data: {
    label: string;
    deviceType: DeviceType;
    ratedPowerKw?: number;
    capacityKwh?: number;
    // PV Panel
    panelCount?: number;
    efficiency?: number;
    tiltAngle?: number;
    azimuth?: number;
    // Inverter
    inverterType?: string;
    // Battery
    chemistry?: string;
    cycleLife?: number;
    // Charger
    connectorType?: string;
    chargerCount?: number;
    // Load
    loadType?: string;
    dailyHours?: number;
    // Grid
    voltageKv?: number;
    gridType?: string;
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

// ── Agent types ───────────────────────────────────────────────────────────────

export type AgentMode = 'plan' | 'agent';

export type AgentReactionType =
  | 'thinking'
  | 'planning'
  | 'tool_call'
  | 'tool_result'
  | 'response'
  | 'error'
  | 'question';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reactionType?: AgentReactionType;
  toolName?: string;
  toolInput?: unknown;
  toolSuccess?: boolean;
  timestamp: number;
}

export interface AgentConversation {
  id: string;
  mode: AgentMode;
  messages: AgentMessage[];
  topologySnapshot?: Topology;
  createdAt: number;
}
