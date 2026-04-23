import { create } from 'zustand';
import type { TopologyNode, TopologyEdge, DeviceType } from '@gp16/shared';

interface Snapshot {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

interface TopologyState {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  selectedNodeId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  setNodes: (nodes: TopologyNode[]) => void;
  setEdges: (edges: TopologyEdge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  updateNode: (id: string, data: Partial<TopologyNode['data']>) => void;
  deleteNode: (id: string) => void;
  addNode: (node: TopologyNode) => void;
  addEdge: (edge: TopologyEdge) => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
  autoLayout: () => void;
}

const MAX_HISTORY = 50;

function snapshot(s: Pick<TopologyState, 'nodes' | 'edges'>): Snapshot {
  return { nodes: s.nodes, edges: s.edges };
}

// Device layout presets — positions by type
const DEVICE_LAYOUT: Record<DeviceType, { col: number; row: number }> = {
  pv_panel:   { col: 0, row: 0 },
  inverter:   { col: 1, row: 0 },
  battery:    { col: 1, row: 1 },
  charger:    { col: 2, row: 1 },
  load:       { col: 2, row: 0 },
  grid:       { col: 2, row: 2 },
};

const GRID_SPACING_X = 220;
const GRID_SPACING_Y = 160;
const GRID_ORIGIN = { x: 100, y: 100 };

export const useTopologyStore = create<TopologyState>((set, get) => {
  let undoStack: Snapshot[] = [];
  let redoStack: Snapshot[] = [];

  function pushHistory() {
    const s = snapshot(get());
    undoStack.push(s);
    if (undoStack.length > MAX_HISTORY) undoStack = undoStack.slice(-MAX_HISTORY);
    redoStack = [];
  }

  function restore(snap: Snapshot) {
    set({ nodes: snap.nodes, edges: snap.edges });
  }

  return {
    nodes: [],
    edges: [],
    selectedNodeId: null,
    canUndo: false,
    canRedo: false,

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

    updateNode: (id, data) => {
      pushHistory();
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n
        ),
      }));
    },

    deleteNode: (id) => {
      pushHistory();
      set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== id),
        edges: s.edges.filter((e) => e.source !== id && e.target !== id),
        selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      }));
    },

    addNode: (node) => {
      pushHistory();
      set((s) => ({ nodes: [...s.nodes, node] }));
    },

    addEdge: (edge) => {
      pushHistory();
      set((s) => ({ edges: [...s.edges, edge] }));
    },

    reset: () => {
      pushHistory();
      set({ nodes: [], edges: [], selectedNodeId: null });
    },

    undo: () => {
      const s = snapshot(get());
      if (undoStack.length === 0) return;
      const prev = undoStack.pop()!;
      redoStack.push(s);
      restore(prev);
      set({
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
      });
    },

    redo: () => {
      const s = snapshot(get());
      if (redoStack.length === 0) return;
      const next = redoStack.pop()!;
      undoStack.push(s);
      restore(next);
      set({
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
      });
    },

    autoLayout: () => {
      pushHistory();
      const { nodes } = get();
      // Group by device type, assign grid positions
      const typeCounters: Record<string, number> = {};
      const layoutNodes = nodes.map((n) => {
        const type = n.data.deviceType;
        const layout = DEVICE_LAYOUT[type];
        const idx = typeCounters[type] ?? 0;
        typeCounters[type] = idx + 1;

        // If we have a predefined layout, use it with offset for duplicates
        if (layout) {
          return {
            ...n,
            position: {
              x: GRID_ORIGIN.x + layout.col * GRID_SPACING_X + (idx > 0 ? (idx % 2) * 100 : 0),
              y: GRID_ORIGIN.y + layout.row * GRID_SPACING_Y + (idx > 0 ? Math.floor(idx / 2) * 100 : 0),
            },
          };
        }
        return n;
      });
      set({ nodes: layoutNodes });
    },
  };
});
