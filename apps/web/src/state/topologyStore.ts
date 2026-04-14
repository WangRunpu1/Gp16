import { create } from 'zustand';
import type { TopologyNode, TopologyEdge } from '@gp16/shared';

interface TopologyState {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  selectedNodeId: string | null;
  setNodes: (nodes: TopologyNode[]) => void;
  setEdges: (edges: TopologyEdge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  updateNode: (id: string, data: Partial<TopologyNode['data']>) => void;
  deleteNode: (id: string) => void;
  reset: () => void;
}

export const useTopologyStore = create<TopologyState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  updateNode: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),
  deleteNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    })),
  reset: () => set({ nodes: [], edges: [], selectedNodeId: null }),
}));
