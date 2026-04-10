import { create } from 'zustand';
import type { TopologyNode, TopologyEdge } from '@gp16/shared';

interface TopologyState {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  setNodes: (nodes: TopologyNode[]) => void;
  setEdges: (edges: TopologyEdge[]) => void;
  reset: () => void;
}

export const useTopologyStore = create<TopologyState>((set) => ({
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  reset: () => set({ nodes: [], edges: [] }),
}));
