import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, applyEdgeChanges, applyNodeChanges,
  type Connection, type Edge, type Node, type NodeChange, type EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useTopologyStore } from '@/state/topologyStore';
import type { DeviceType } from '@gp16/shared';
import { DEVICE_ICON } from './DeviceIcons';

const ACCENT: Record<DeviceType, string> = {
  pv_panel: '#faad14', inverter: '#1677ff', battery: '#52c41a',
  charger: '#eb2f96',  load: '#722ed1',     grid: '#fa8c16',
};
const BG: Record<DeviceType, string> = {
  pv_panel: '#fffbe6', inverter: '#e6f4ff', battery: '#f6ffed',
  charger: '#fff0f6',  load: '#f9f0ff',     grid: '#fff7e6',
};
const LABEL: Record<DeviceType, string> = {
  pv_panel: '光伏板', inverter: '逆变器', battery: '储能',
  charger: '充电桩',  load: '负载',       grid: '电网',
};

interface NodeData {
  label: string;
  deviceType: DeviceType;
  ratedPowerKw?: number;
  capacityKwh?: number;
  efficiency?: number;
  selected?: boolean;
}

function DeviceNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  const type = data.deviceType;
  const accent = ACCENT[type] ?? '#d9d9d9';
  const bg     = BG[type]     ?? '#f5f5f5';
  const Icon   = DEVICE_ICON[type];

  const spec = data.capacityKwh != null
    ? `${data.capacityKwh} kWh`
    : data.ratedPowerKw != null
    ? `${data.ratedPowerKw} kW`
    : null;

  return (
    <div style={{
      width: 140, borderRadius: 10,
      background: bg,
      border: `2px solid ${selected ? accent : accent + '99'}`,
      boxShadow: selected
        ? `0 0 0 3px ${accent}44, 0 4px 16px ${accent}33`
        : '0 2px 8px rgba(0,0,0,0.10)',
      overflow: 'hidden',
      transition: 'box-shadow 0.15s, border-color 0.15s',
    }}>
      {/* Colored top stripe */}
      <div style={{ height: 4, background: accent }} />

      {/* Body */}
      <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Icon size={34} />
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', textAlign: 'center', lineHeight: 1.3 }}>
          {data.label}
        </div>
        {spec && (
          <div style={{
            fontSize: 10, color: '#fff', background: accent,
            borderRadius: 10, padding: '1px 8px', fontWeight: 600,
          }}>
            {spec}
          </div>
        )}
        <div style={{ fontSize: 10, color: accent, fontWeight: 500, opacity: 0.8 }}>
          {LABEL[type]}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { device: DeviceNode };

export function TopologyCanvas() {
  const storeNodes        = useTopologyStore((s) => s.nodes);
  const storeEdges        = useTopologyStore((s) => s.edges);
  const selectedNodeId    = useTopologyStore((s) => s.selectedNodeId);
  const setStoreNodes     = useTopologyStore((s) => s.setNodes);
  const setStoreEdges     = useTopologyStore((s) => s.setEdges);
  const setSelectedNodeId = useTopologyStore((s) => s.setSelectedNodeId);

  const nodes: Node[] = useMemo(() =>
    storeNodes.map((n) => ({
      id: n.id,
      position: n.position,
      data: {
        label: n.data.label,
        deviceType: n.data.deviceType,
        ratedPowerKw: n.data.ratedPowerKw,
        capacityKwh: n.data.capacityKwh,
        efficiency: n.data.efficiency,
        selected: n.id === selectedNodeId,
      },
      type: 'device',
      selected: n.id === selectedNodeId,
    })), [storeNodes, selectedNodeId]);

  const edges: Edge[] = useMemo(() =>
    storeEdges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed' as any, color: '#94a3b8' },
    })), [storeEdges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const next = applyNodeChanges(changes, nodes);
    const cur  = useTopologyStore.getState().nodes;
    const map  = new Map(cur.map((n) => [n.id, n]));
    setStoreNodes(next.map((n) => {
      const ex = map.get(n.id);
      return {
        id: n.id, position: n.position,
        data: {
          label:        String((n.data as any)?.label ?? ex?.data.label ?? ''),
          deviceType:   ex?.data.deviceType ?? 'load',
          ratedPowerKw: ex?.data.ratedPowerKw,
          capacityKwh:  ex?.data.capacityKwh,
          efficiency:   ex?.data.efficiency,
          panelCount:   ex?.data.panelCount,
          tiltAngle:    ex?.data.tiltAngle,
          azimuth:      ex?.data.azimuth,
          inverterType: ex?.data.inverterType,
          chemistry:    ex?.data.chemistry,
          cycleLife:    ex?.data.cycleLife,
          connectorType:ex?.data.connectorType,
          chargerCount: ex?.data.chargerCount,
          loadType:     ex?.data.loadType,
          dailyHours:   ex?.data.dailyHours,
          voltageKv:    ex?.data.voltageKv,
          gridType:     ex?.data.gridType,
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

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        deleteKeyCode="Delete"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <MiniMap
          nodeColor={(n) => ACCENT[(n.data as any)?.deviceType as DeviceType] ?? '#d9d9d9'}
          style={{ background: '#f8fafc' }}
        />
        <Controls />
        <Background color="#e2e8f0" gap={20} />
      </ReactFlow>
    </div>
  );
}
