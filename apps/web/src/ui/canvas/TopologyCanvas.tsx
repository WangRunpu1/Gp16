import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, applyEdgeChanges, applyNodeChanges,
  type Connection, type Edge, type Node, type NodeChange, type EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useTopologyStore } from '@/state/topologyStore';
import type { DeviceType } from '@gp16/shared';

const COLORS: Record<DeviceType, string> = {
  pv_panel: '#fffbe6', inverter: '#e6f4ff', battery: '#f6ffed',
  charger: '#fff0f6',  load: '#f9f0ff',     grid: '#fff7e6',
};
const BORDER: Record<DeviceType, string> = {
  pv_panel: '#faad14', inverter: '#1677ff', battery: '#52c41a',
  charger: '#eb2f96',  load: '#722ed1',     grid: '#fa8c16',
};
const ICONS: Record<DeviceType, string> = {
  pv_panel: '☀️', inverter: '⚡', battery: '🔋',
  charger: '🔌',  load: '🏭',     grid: '🔆',
};

function DeviceNode({ data }: { data: { label: string; deviceType: DeviceType } }) {
  const bg     = COLORS[data.deviceType] ?? '#f5f5f5';
  const border = BORDER[data.deviceType] ?? '#d9d9d9';
  const icon   = ICONS[data.deviceType] ?? '📦';
  return (
    <div style={{
      padding: '8px 14px', borderRadius: 8, background: bg,
      border: `2px solid ${border}`, fontSize: 12, fontWeight: 500,
      minWidth: 100, textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
      <div>{data.label}</div>
    </div>
  );
}

// IMPORTANT: define nodeTypes outside component to avoid re-registration bug
const nodeTypes = { device: DeviceNode };

export function TopologyCanvas() {
  const storeNodes = useTopologyStore((s) => s.nodes);
  const storeEdges = useTopologyStore((s) => s.edges);
  const setStoreNodes = useTopologyStore((s) => s.setNodes);
  const setStoreEdges = useTopologyStore((s) => s.setEdges);

  const nodes: Node[] = useMemo(() =>
    storeNodes.map((n) => ({
      id: n.id,
      position: n.position,
      data: { label: n.data.label, deviceType: n.data.deviceType },
      type: 'device',
    })), [storeNodes]);

  const edges: Edge[] = useMemo(() =>
    storeEdges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed' as any, color: '#94a3b8' },
    })), [storeEdges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const next = applyNodeChanges(changes, nodes);
    const cur = useTopologyStore.getState().nodes;
    const map = new Map(cur.map((n) => [n.id, n]));
    setStoreNodes(next.map((n) => {
      const ex = map.get(n.id);
      return {
        id: n.id, position: n.position,
        data: {
          label: String((n.data as any)?.label ?? ex?.data.label ?? ''),
          deviceType: ex?.data.deviceType ?? 'load',
          ratedPowerKw: ex?.data.ratedPowerKw,
          capacityKwh: ex?.data.capacityKwh,
        },
      };
    }));
  }, [nodes, setStoreNodes]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const next = applyEdgeChanges(changes, edges);
    setStoreEdges(next.map((e) => ({ id: e.id, source: e.source, target: e.target })));
  }, [edges, setStoreEdges]);

  const onConnect = useCallback((conn: Connection) => {
    const next = addEdge(conn, edges);
    setStoreEdges(next.map((e) => ({ id: e.id, source: e.source, target: e.target })));
  }, [edges, setStoreEdges]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <MiniMap nodeColor={(n) => BORDER[(n.data as any)?.deviceType as DeviceType] ?? '#d9d9d9'} />
        <Controls />
        <Background color="#e2e8f0" gap={20} />
      </ReactFlow>
    </div>
  );
}
