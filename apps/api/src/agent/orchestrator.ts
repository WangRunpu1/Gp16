import type { AgentConversation, AgentMessage, AgentMode, AILayoutResult, Topology } from '@gp16/shared';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { AgentTool, AgentContext } from './tools/index.js';
import { layoutTool, analysisTool, validateTool } from './tools/index.js';

// ── LLM call (reused from worker.ts) ──────────────────────────────────────────

async function callLLM(
  messages: { role: string; content: string }[],
  options: { json?: boolean; temperature?: number } = {},
): Promise<string | null> {
  const base = process.env.LLM_API_BASE;
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? 'qwen-plus';
  if (!base || !key) return null;

  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');

  const res = await fetch(`${trimmed}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.7,
      messages: systemMsg ? [systemMsg, ...userMsgs] : userMsgs,
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as any;
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') return null;

  if (options.json) {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try { JSON.parse(cleaned); return cleaned; } catch {
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      if (s >= 0 && e > s) return cleaned.slice(s, e + 1);
      return null;
    }
  }
  return text;
}

// ── System prompts ────────────────────────────────────────────────────────────

const PLAN_SYSTEM = `你是资深光伏系统设计顾问。你的任务是：
1. 分析用户的系统需求
2. 给出专业的设计建议、参数推荐
3. 指出潜在风险和注意事项
4. 可以用 question 类型向用户提问确认

你的回复必须使用以下 JSON 格式（数组）：
[
  {"reactionType":"thinking","content":"思考过程"},
  {"reactionType":"planning","content":"1. 分析需求\\n2. 给出建议"},
  {"reactionType":"response","content":"给用户的建议..."},
  {"reactionType":"question","content":"你希望装机容量多大？"}
]

只输出 JSON 数组，不要其他内容。`;

const AGENT_SYSTEM = `你是光伏系统设计 Agent，可以自主执行工具。你的任务是：
1. 分析用户需求
2. 调用 layout 工具生成拓扑
3. 调用 analysis 工具评估绿色效益
4. 将结果应用到画布

可用工具：
- layout: 生成系统拓扑 {"prompt": "用户需求描述"}
- analysis: 分析当前拓扑的绿色效益
- validate: 验证拓扑合理性

你的回复必须使用以下 JSON 格式（数组）：
[
  {"reactionType":"thinking","content":"分析用户需求..."},
  {"reactionType":"tool_call","toolName":"layout","toolInput":{"prompt":"..."},"content":"正在生成布局..."},
  {"reactionType":"tool_result","toolName":"layout","toolSuccess":true,"content":"布局已生成：5节点，4连接"},
  {"reactionType":"tool_call","toolName":"analysis","toolInput":{},"content":"正在分析..."},
  {"reactionType":"tool_result","toolName":"analysis","toolSuccess":true,"content":"年发电量: 12000kWh"},
  {"reactionType":"response","content":"布局已应用到画布！年发电量约12000kWh..."}
]

只输出 JSON 数组，不要其他内容。`;

// ── Message schema for LLM output parsing ─────────────────────────────────────

const reactionSchema = z.object({
  reactionType: z.enum(['thinking', 'planning', 'tool_call', 'tool_result', 'response', 'error', 'question']),
  content: z.string(),
  toolName: z.string().optional(),
  toolInput: z.unknown().optional(),
  toolSuccess: z.boolean().optional(),
});

// ── Heuristic response (fallback when LLM unavailable) ────────────────────────

function heuristicPlan(prompt: string): AgentMessage[] {
  const kwMatch = prompt.match(/(\d+(?:\.\d+)?)\s*kW/i);
  const kwhMatch = prompt.match(/(\d+(?:\.\d+)?)\s*kWh/i);
  const pvKw = kwMatch ? Number(kwMatch[1]) : 10;
  const battKwh = kwhMatch ? Number(kwhMatch[1]) : 20;
  const now = Date.now();

  return [
    { id: randomUUID(), role: 'assistant', content: `分析用户需求：${pvKw}kW 光伏 + ${battKwh}kWh 储能`, reactionType: 'thinking', timestamp: now },
    { id: randomUUID(), role: 'assistant', content: '建议配置：组串式逆变器 + 磷酸铁锂电池 + 并网接入', reactionType: 'planning', timestamp: now + 1 },
    { id: randomUUID(), role: 'assistant', content: `推荐方案：${pvKw}kW 光伏阵列搭配 ${battKwh}kWh 储能系统。\n• 建议采用组串式逆变器，便于后期扩展\n• 储能建议选磷酸铁锂（LFP），循环寿命长\n• 并网接入，余电上网可获收益`, reactionType: 'response', timestamp: now + 2 },
  ];
}

function heuristicAgent(prompt: string, topology?: Topology): AgentMessage[] {
  const now = Date.now();
  return [
    { id: randomUUID(), role: 'assistant', content: '正在分析需求并生成布局...', reactionType: 'thinking', timestamp: now },
    { id: randomUUID(), role: 'assistant', content: '生成系统拓扑', reactionType: 'tool_call', toolName: 'layout', toolInput: { prompt }, timestamp: now + 1 },
    { id: randomUUID(), role: 'assistant', content: '拓扑已生成，5 台设备，4 条连接', reactionType: 'tool_result', toolName: 'layout', toolSuccess: true, timestamp: now + 2 },
    { id: randomUUID(), role: 'assistant', content: '已应用到画布！共 5 台设备、4 条连接。', reactionType: 'response', timestamp: now + 3 },
  ];
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function runAgentLoop(
  conversation: AgentConversation,
  userInput: string,
  currentTopology?: Topology,
): Promise<{ messages: AgentMessage[]; layout?: AILayoutResult }> {
  const mode = conversation.mode;
  const now = Date.now();

  // Build conversation history
  const historyText = conversation.messages
    .map(m => `[${m.reactionType ?? m.role}] ${m.content}`)
    .join('\n');

  const prompt = `当前画布状态：${currentTopology ? `${currentTopology.nodes.length} 台设备，${currentTopology.edges.length} 条连接` : '空画布'}\n\n历史对话：\n${historyText}\n\n用户输入：${userInput}`;

  // Try LLM first
  let llmMessages: AgentMessage[] | null = null;
  try {
    const systemPrompt = mode === 'plan' ? PLAN_SYSTEM : AGENT_SYSTEM;
    const llmResponse = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      { json: true, temperature: mode === 'plan' ? 0.7 : 0.3 },
    );

    if (llmResponse) {
      const parsed = JSON.parse(llmResponse) as z.infer<typeof reactionSchema>[];
      const validated = z.array(reactionSchema).safeParse(parsed);
      if (validated.success) {
        llmMessages = validated.data.map(r => ({
          id: randomUUID(),
          role: 'assistant' as const,
          content: r.content,
          reactionType: r.reactionType,
          toolName: r.toolName,
          toolInput: r.toolInput,
          toolSuccess: r.toolSuccess,
          timestamp: now + Math.random(),
        }));
      }
    }
  } catch (e) {
    console.warn('[agent][llm] error, using heuristic fallback', e);
  }

  // Fallback to heuristic
  const messages = llmMessages ?? (
    mode === 'plan' ? heuristicPlan(userInput) : heuristicAgent(userInput, currentTopology)
  );

  // If agent mode and LLM produced tool_calls, execute them
  let layoutResult: AILayoutResult | undefined;
  if (mode === 'agent') {
    const toolCalls = messages.filter(m => m.reactionType === 'tool_call');
    const ctx: AgentContext = { topology: currentTopology, prompt: userInput };

    for (const tc of toolCalls) {
      const tool = [layoutTool, analysisTool, validateTool].find(t => t.name === tc.toolName);
      const resultMsg: AgentMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: '',
        reactionType: 'tool_result',
        toolName: tc.toolName,
        toolSuccess: false,
        timestamp: Date.now() + Math.random(),
      };

      try {
        if (tool) {
          const result = await tool.execute(tc.toolInput ?? {}, ctx);
          resultMsg.toolSuccess = true;
          resultMsg.content = result.summary;

          if (tc.toolName === 'layout' && result.data) {
            layoutResult = result.data as AILayoutResult;
          }
        } else {
          resultMsg.content = `未知工具：${tc.toolName}`;
        }
      } catch (e: any) {
        resultMsg.content = `执行失败：${e?.message ?? e}`;
      }

      messages.push(resultMsg);
    }
  }

  return { messages, layout: layoutResult };
}

// ── Heuristic layout (for agent mode tool execution) ──────────────────────────

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
    assumptions: [
      `光伏装机容量：${pvKw} kW`,
      `储能容量：${battKwh} kWh`,
      '并网 + 储能拓扑',
      '逆变器功率与光伏匹配',
    ],
  };
}
