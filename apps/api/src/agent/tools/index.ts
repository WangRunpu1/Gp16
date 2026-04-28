import type { AILayoutResult, Topology } from '@gp16/shared';
import { z } from 'zod';

export interface AgentContext {
  topology?: Topology;
  prompt: string;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  summary: string;
  data?: T;
}

export interface AgentTool {
  name: string;
  description: string;
  execute(input: Record<string, unknown>, context: AgentContext): Promise<ToolResult>;
}

// ── Layout Tool ───────────────────────────────────────────────────────────────

function heuristicLayout(prompt: string): AILayoutResult {
  const kwMatch = prompt.match(/(\d+(?:\.\d+)?)\s*kW/i);
  const kwhMatch = prompt.match(/(\d+(?:\.\d+)?)\s*kWh/i);
  const pvKw = kwMatch ? Number(kwMatch[1]) : 10;
  const battKwh = kwhMatch ? Number(kwhMatch[1]) : 20;

  return {
    layoutVersion: 'v1',
    topology: {
      nodes: [
        { id: 'pv1', position: { x: 100, y: 100 }, data: { label: `光伏阵列 ${pvKw}kW`, deviceType: 'pv_panel', ratedPowerKw: pvKw } },
        { id: 'inv1', position: { x: 340, y: 100 }, data: { label: `逆变器 ${pvKw}kW`, deviceType: 'inverter', ratedPowerKw: pvKw } },
        { id: 'bat1', position: { x: 340, y: 260 }, data: { label: `储能 ${battKwh}kWh`, deviceType: 'battery', capacityKwh: battKwh } },
        { id: 'load1', position: { x: 580, y: 100 }, data: { label: `负载 ${(pvKw * 0.6).toFixed(1)}kW`, deviceType: 'load', ratedPowerKw: pvKw * 0.6 } },
        { id: 'grid1', position: { x: 580, y: 260 }, data: { label: '电网', deviceType: 'grid' } },
      ],
      edges: [
        { id: 'e1', source: 'pv1', target: 'inv1' },
        { id: 'e2', source: 'inv1', target: 'load1' },
        { id: 'e3', source: 'bat1', target: 'inv1' },
        { id: 'e4', source: 'grid1', target: 'inv1' },
      ],
    },
    assumptions: [`光伏 ${pvKw}kW + 储能 ${battKwh}kWh`],
  };
}

async function callLLMForLayout(prompt: string): Promise<AILayoutResult | null> {
  const base = process.env.LLM_API_BASE;
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? 'qwen-plus';
  if (!base || !key) return null;

  const system = [
    '你是资深电气工程师，只输出严格 JSON。',
    '格式：{"layoutVersion":"v1","topology":{"nodes":[...],"edges":[...]},"assumptions":[...]}',
    'deviceType 必须是：pv_panel | inverter | battery | charger | load | grid',
    '只输出 JSON。',
  ].join('\n');

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0.2, messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ]}),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') return null;

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
    return null;
  }
}

export const layoutTool: AgentTool = {
  name: 'layout',
  description: 'Generate a PV system topology layout',
  async execute(input, ctx) {
    const prompt = (input.prompt as string) ?? ctx.prompt;

    // Schema to validate LLM output — must match expected structure
    const layoutSchema = z.object({
      layoutVersion: z.string(),
      topology: z.object({
        nodes: z.array(z.object({
          id: z.string(),
          position: z.object({ x: z.number(), y: z.number() }),
          data: z.object({
            label: z.string(),
            deviceType: z.enum(['pv_panel', 'inverter', 'battery', 'charger', 'load', 'grid']),
            ratedPowerKw: z.number().optional(),
            capacityKwh: z.number().optional(),
          }),
        })),
        edges: z.array(z.object({
          id: z.string(),
          source: z.string(),
          target: z.string(),
        })),
      }),
      assumptions: z.array(z.string()),
    });

    let result: AILayoutResult;
    const llmResult = await callLLMForLayout(prompt).catch(() => null);
    if (llmResult) {
      const parsed = layoutSchema.safeParse(llmResult);
      if (parsed.success) {
        result = parsed.data as AILayoutResult;
      } else {
        console.warn('[layoutTool] LLM result schema invalid, falling back to heuristic', parsed.error.issues);
        result = heuristicLayout(prompt);
      }
    } else {
      result = heuristicLayout(prompt);
    }

    return {
      success: true,
      summary: `布局已生成：${result.topology.nodes.length} 台设备，${result.topology.edges.length} 条连接`,
      data: result,
    };
  },
};

// ── Analysis Tool ─────────────────────────────────────────────────────────────

export const analysisTool: AgentTool = {
  name: 'analysis',
  description: 'Run green impact analysis on current topology',
  async execute(_input, ctx) {
    if (!ctx.topology || ctx.topology.nodes.length === 0) {
      return { success: false, summary: '画布为空，请先添加设备' };
    }
    // Simplified analysis (full analysis runs via HTTP endpoint)
    const pvNodes = ctx.topology.nodes.filter(n => n.data.deviceType === 'pv_panel');
    const totalKw = pvNodes.reduce((s, n) => s + (n.data.ratedPowerKw ?? 0), 0);
    const annualGen = totalKw * 1200; // simplified
    return {
      success: true,
      summary: `光伏装机 ${totalKw.toFixed(1)}kW，年发电量约 ${Math.round(annualGen).toLocaleString()}kWh`,
    };
  },
};

// ── Validate Tool ─────────────────────────────────────────────────────────────

export const validateTool: AgentTool = {
  name: 'validate',
  description: 'Validate topology correctness',
  async execute(_input, ctx) {
    if (!ctx.topology || ctx.topology.nodes.length === 0) {
      return { success: false, summary: '画布为空' };
    }
    const issues: string[] = [];
    const hasPv = ctx.topology.nodes.some(n => n.data.deviceType === 'pv_panel');
    const hasInv = ctx.topology.nodes.some(n => n.data.deviceType === 'inverter');
    if (hasPv && !hasInv) issues.push('光伏板未连接逆变器');
    if (ctx.topology.edges.length === 0) issues.push('无连接关系');
    return {
      success: issues.length === 0,
      summary: issues.length === 0 ? '拓扑验证通过' : `发现 ${issues.length} 个问题：${issues.join('；')}`,
    };
  },
};
