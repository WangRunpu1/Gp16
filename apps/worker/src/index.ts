import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DeviceType } from '@gp16/shared';

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

// ── Schema ────────────────────────────────────────────────────────────────────
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

// ── Heuristic fallback ────────────────────────────────────────────────────────
function heuristicLayout(prompt: string) {
  const kwMatch = prompt.match(/(\d+(?:\.\d+)?)\s*kW/i);
  const kwhMatch = prompt.match(/(\d+(?:\.\d+)?)\s*kWh/i);
  const pvKw = kwMatch ? Number(kwMatch[1]) : 10;
  const battKwh = kwhMatch ? Number(kwhMatch[1]) : 20;

  return {
    layoutVersion: 'v1',
    topology: {
      nodes: [
        { id: 'pv1',   position: { x: 100, y: 100 }, data: { label: `光伏阵列 ${pvKw}kW`,   deviceType: 'pv_panel'  as DeviceType, ratedPowerKw: pvKw } },
        { id: 'inv1',  position: { x: 340, y: 100 }, data: { label: `逆变器 ${pvKw}kW`,     deviceType: 'inverter'  as DeviceType, ratedPowerKw: pvKw } },
        { id: 'bat1',  position: { x: 340, y: 260 }, data: { label: `储能 ${battKwh}kWh`,   deviceType: 'battery'   as DeviceType, capacityKwh: battKwh } },
        { id: 'load1', position: { x: 580, y: 100 }, data: { label: `负载 ${(pvKw*0.6).toFixed(1)}kW`, deviceType: 'load' as DeviceType, ratedPowerKw: pvKw * 0.6 } },
        { id: 'grid1', position: { x: 580, y: 260 }, data: { label: '电网',                 deviceType: 'grid'      as DeviceType } },
      ],
      edges: [
        { id: 'e1', source: 'pv1',  target: 'inv1'  },
        { id: 'e2', source: 'inv1', target: 'load1' },
        { id: 'e3', source: 'bat1', target: 'inv1'  },
        { id: 'e4', source: 'grid1',target: 'inv1'  },
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

// ── LLM call ──────────────────────────────────────────────────────────────────
async function callLLM(prompt: string): Promise<unknown> {
  const base = process.env.LLM_API_BASE;
  const key  = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? 'qwen-plus';
  if (!base || !key) return null;

  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  const system = [
    '你是资深电气工程师，只输出严格 JSON，不含任何 markdown 代码块或解释文字。',
    '输出格式：{"layoutVersion":"v1","topology":{"nodes":[...],"edges":[...]},"assumptions":[...]}',
    'nodes[i].data.deviceType 必须是：pv_panel | inverter | battery | charger | load | grid',
    'nodes[i] 必须有 id、position({x,y})、data({label,deviceType,ratedPowerKw?,capacityKwh?})',
    'edges[i] 必须有 id、source、target（对应 nodes 的 id）',
    '只输出 JSON，不输出其他任何内容。',
  ].join('\n');

  const res = await fetch(`${trimmed}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0.2, messages: [
      { role: 'system', content: system },
      { role: 'user',   content: prompt },
    ]}),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json() as any;
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') return null;

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
    return null;
  }
}

// ── SVG Topology Renderer (sticker-style nodes) ─────────────────────────────────
function esc(s: string) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

interface DeviceStyle {
  icon: string; fill: string; stroke: string; accent: string; title: string;
}

function getDeviceStyle(dt: string, lang: 'zh' | 'en'): DeviceStyle {
  const map: Record<string, { icon: string; fill: string; stroke: string; accent: string; zh: string; en: string }> = {
    pv_panel:  { icon: '☀️', fill: '#fff8e1', stroke: '#f59e0b', accent: '#fcd34d', zh: '光伏板',   en: 'PV Panel' },
    inverter:  { icon: '🔄',   fill: '#eff6ff', stroke: '#3b82f6', accent: '#93c5fd', zh: '逆变器',   en: 'Inverter' },
    battery:   { icon: '🔋',   fill: '#f0fdf4', stroke: '#16a34a', accent: '#86efac', zh: '储能',     en: 'Battery' },
    charger:   { icon: '🔌',   fill: '#fdf2f8', stroke: '#ec4899', accent: '#f9a8d4', zh: '充电桩',   en: 'Charger' },
    load:      { icon: '🏠',   fill: '#faf5ff', stroke: '#8b5cf6', accent: '#c4b5fd', zh: '负载',     en: 'Load' },
    grid:      { icon: '⚡',         fill: '#fff7ed', stroke: '#f97316', accent: '#fdba74', zh: '电网',     en: 'Grid' },
  };
  const v = map[dt] ?? { icon: '📦', fill: '#f5f5f5', stroke: '#94a3b8', accent: '#cbd5e1', zh: dt, en: dt };
  return { icon: v.icon, fill: v.fill, stroke: v.stroke, accent: v.accent, title: lang === 'zh' ? v.zh : v.en };
}

function topologyToSvg(topology: any, lang: 'zh' | 'en' = 'zh'): string {
  const nodes: any[] = topology.nodes ?? [];
  const edges: any[] = topology.edges ?? [];
  const emptyText = lang === 'zh' ? '（无设备）' : '(No devices)';

  if (!nodes.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120"><rect width="100%" height="100%" fill="#fafafa" rx="8"/><text x="200" y="60" text-anchor="middle" fill="#a0aec0" font-size="14" font-family="sans-serif">${emptyText}</text></svg>`;
  }

  const NW = 200, NH = 68; // node card size (wider for longer labels)
  const PAD = 90;

  const minX = Math.min(...nodes.map(n => n.position.x)) - NW / 2;
  const minY = Math.min(...nodes.map(n => n.position.y)) - NH / 2;
  const maxX = Math.max(...nodes.map(n => n.position.x)) + NW / 2;
  const maxY = Math.max(...nodes.map(n => n.position.y)) + NH / 2;

  const vbX = minX - PAD;
  const vbY = minY - PAD;
  const vbW = maxX - minX + 2 * PAD;
  const vbH = maxY - minY + 2 * PAD;
  const svgW = Math.max(800, vbW);
  const svgH = Math.max(420, vbH);

  const nodeById = new Map(nodes.map(n => [n.id, n]));

  const edgeEls = edges.map((e: any) => {
    const s = nodeById.get(e.source);
    const t = nodeById.get(e.target);
    if (!s || !t) return '';
    return `<line x1="${s.position.x}" y1="${s.position.y}" x2="${t.position.x}" y2="${t.position.y}" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round"/>`;
  }).join('');

  const portEls = edges.map((e: any) => {
    const t = nodeById.get(e.target);
    if (!t) return '';
    return `<circle cx="${t.position.x}" cy="${t.position.y}" r="4" fill="#94a3b8"/>`;
  }).join('');

  const nodeEls = nodes.map((n: any) => {
    const cx = n.position.x;
    const cy = n.position.y;
    const dt = n.data?.deviceType ?? '';
    const st = getDeviceStyle(dt, lang);
    const specs: string[] = [];
    if (n.data?.ratedPowerKw != null) specs.push(`${n.data.ratedPowerKw} kW`);
    if (n.data?.capacityKwh != null) specs.push(`${n.data.capacityKwh} kWh`);
    const spec = specs.join('  ·  ');
    const hw = NW / 2, hh = NH / 2;

    let label = n.data?.label ?? n.id;
    const hasCJK = /[一-鿿]/.test(label);
    if (lang === 'en' && hasCJK) {
      label = st.title;
      if (spec) label += ` ${spec}`;
    }
    const maxChars = lang === 'zh' ? 12 : 26;
    if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…';

    return `
    <g transform="translate(${cx},${cy})">
      <rect x="${-hw - 3}" y="${-hh - 3}" width="${NW + 6}" height="${NH + 6}" rx="13" fill="rgba(0,0,0,0.07)"/>
      <rect x="${-hw}" y="${-hh}" width="${NW}" height="${NH}" rx="11" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2"/>
      <rect x="${-hw + 2}" y="${-hh + 2}" width="${NW - 4}" height="5" rx="2.5" fill="${st.accent}"/>
      <rect x="${-hw + 10}" y="${-hh + 16}" width="42" height="36" rx="7" fill="${st.stroke}" fill-opacity="0.12" stroke="${st.stroke}" stroke-width="1" stroke-opacity="0.3"/>
      <text x="${-hw + 31}" y="${-hh + 38}" font-size="22" text-anchor="middle" font-family="sans-serif">${st.icon}</text>
      <text x="${-hw + 60}" y="${-hh + 25}" font-size="12" font-weight="700" fill="#1a202c" font-family="sans-serif">${esc(label)}</text>
      <text x="${-hw + 60}" y="${-hh + 43}" font-size="9.5" fill="#64748b" font-weight="500" font-family="sans-serif">${st.title}${spec ? '  ·  ' + spec : ''}</text>
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${svgW}" height="${svgH}" style="background:#fdfdfd;border-radius:8px">
    <rect width="100%" height="100%" fill="#fdfdfd" rx="8"/>
    <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="0.8" fill="#e2e8f0"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#g)" opacity="0.5"/>
    ${edgeEls}
    ${portEls}
    ${nodeEls}
  </svg>`;
}

// ── AI Commentary ──────────────────────────────────────────────────────────────
async function callLLMForCommentary(payload: { topology: any; analysis: any; lang: 'zh' | 'en' }): Promise<string> {
  const base  = process.env.LLM_API_BASE;
  const key   = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? 'qwen-plus';
  if (!base || !key) return '';

  const isZh = payload.lang === 'zh';
  const topology = payload.topology ?? { nodes: [], edges: [] };
  const analysis = payload.analysis ?? {};

  const nodeList = (topology.nodes ?? []).map((n: any) =>
    isZh
      ? `- ${n.data?.label ?? n.id}（${n.data?.deviceType ?? '未知'}${n.data?.ratedPowerKw ? `，${n.data.ratedPowerKw}kW` : ''}${n.data?.capacityKwh ? `，${n.data.capacityKwh}kWh` : ''}）`
      : `- ${n.data?.label ?? n.id} (${n.data?.deviceType ?? 'unknown'}${n.data?.ratedPowerKw ? `, ${n.data.ratedPowerKw}kW` : ''}${n.data?.capacityKwh ? `, ${n.data.capacityKwh}kWh` : ''})`
  ).join('\n');

  const s = analysis?.summary;
  const kpiText = s
    ? isZh
      ? `光伏装机 ${s.pvInstalledKw}kW，年发电量 ${s.annualGenerationKwh}kWh，年减排 CO₂ ${s.annualCo2SavedTons}吨，等效植树 ${s.equivalentTrees}棵，总投资 ¥${s.totalCapex}，回收期 ${analysis?.simplePaybackYears}年`
      : `PV ${s.pvInstalledKw}kW, Annual Gen ${s.annualGenerationKwh}kWh, CO₂ Saved ${s.annualCo2SavedTons}t/yr, Trees ${s.equivalentTrees}, CAPEX ¥${s.totalCapex}, Payback ${analysis?.simplePaybackYears}yr`
    : '';

  const system = isZh
    ? '你是资深光伏/电力系统工程师。请用专业、简洁的中文撰写报告章节。150-250字。只输出正文，不含标题或markdown。'
    : 'You are a senior PV/power systems engineer. Write a professional, concise report section in English. 150-250 words. Output body text only, no title or markdown.';

  const userPrompt = isZh
    ? `请为此光伏系统设计方案撰写一段"项目概述与技术亮点"：\n\n设备清单：\n${nodeList}\n\n性能指标：${kpiText}\n\n要求：突出设计合理性、绿色效益和技术亮点。`
    : `Write a "Project Overview & Technical Highlights" section for this PV system design:\n\nDevices:\n${nodeList}\n\nKPIs: ${kpiText}\n\nHighlight design rationale, green benefits, and technical merits.`;

  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;

  try {
    const res = await fetch(`${trimmed}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.6, messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ]}),
    });
    if (!res.ok) return '';
    const json = await res.json() as any;
    const text = json?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? text.trim() : '';
  } catch {
    return '';
  }
}

// ── Server-side analysis (fallback when frontend data not yet available) ─────────
function computeAnalysis(topology: { nodes: any[] }, cfg: Record<string, number> = {}): {
  summary: { pvInstalledKw: number; inverterKw: number; battKwh: number; annualGenerationKwh: number; annualCo2SavedTons: number; equivalentTrees: number; totalCapex: number };
  costSeries: { year: number; traditionalCost: number; schemeCost: number }[];
  simplePaybackYears: number | null;
} {
  const c = {
    electricityPricePerKwh: cfg.electricityPricePerKwh ?? 0.85,
    fullLoadHoursPerYear: cfg.fullLoadHoursPerYear ?? 1200,
    gridEmissionFactor: cfg.gridEmissionFactor ?? 0.55,
    performanceRatio: cfg.performanceRatio ?? 0.8,
    pvUnitCostPerKw: cfg.pvUnitCostPerKw ?? 900,
    inverterUnitCostPerKw: cfg.inverterUnitCostPerKw ?? 150,
    battUnitCostPerKwh: cfg.battUnitCostPerKwh ?? 400,
  };
  const nodes = topology.nodes ?? [];
  const pvKw = nodes.filter((n: any) => n.data?.deviceType === 'pv_panel').reduce((s: number, n: any) => s + (n.data?.ratedPowerKw ?? 0), 0);
  const invKw = nodes.filter((n: any) => n.data?.deviceType === 'inverter').reduce((s: number, n: any) => s + (n.data?.ratedPowerKw ?? 0), 0);
  const battKwh = nodes.filter((n: any) => n.data?.deviceType === 'battery').reduce((s: number, n: any) => s + (n.data?.capacityKwh ?? 0), 0);
  const annualGen = pvKw * c.fullLoadHoursPerYear * c.performanceRatio;
  const annualCo2 = (annualGen * c.gridEmissionFactor) / 1000;
  const trees = Math.round(annualCo2 * 50);
  const capex = pvKw * c.pvUnitCostPerKw + invKw * c.inverterUnitCostPerKw + battKwh * c.battUnitCostPerKwh;
  const saving = annualGen * c.electricityPricePerKwh;
  const payback = saving > 0 ? capex / saving : null;
  const maint = pvKw * 20;
  const series = Array.from({ length: 10 }, (_, i) => {
    const y = i + 1;
    return { year: y, traditionalCost: Math.round(y * saving), schemeCost: Math.round(capex + y * maint) };
  });
  return {
    summary: { pvInstalledKw: pvKw, inverterKw: invKw, battKwh, annualGenerationKwh: annualGen, annualCo2SavedTons: annualCo2, equivalentTrees: trees, totalCapex: capex },
    costSeries: series,
    simplePaybackYears: payback,
  };
}

// ── HTML Report (professional bilingual + html2pdf.js) ────────────────────────
async function generateReport(payload: any): Promise<{ reportId: string; htmlPath: string }> {
  const reportId  = String(payload.reportId ?? payload.taskId ?? Date.now());
  const topology  = payload.topology  ?? { nodes: [], edges: [] };
  let analysis  = payload.analysis  ?? null;
  const config   = payload.config   ?? {};
  // Compute analysis server-side if frontend hasn't provided it (avoids race with debounced hook)
  if (!analysis && topology?.nodes?.length) {
    analysis = computeAnalysis(topology, config);
  }
  const lang: 'zh' | 'en' = payload.lang === 'en' ? 'en' : 'zh';
  const svg = topologyToSvg(topology, lang);
  const commentary = await callLLMForCommentary({ topology, analysis, lang });

  const L = {
    title: lang === 'zh' ? '光伏/电力系统 AI 辅助设计报告' : 'PV System AI-Assisted Design Report',
    subtitle: lang === 'zh' ? 'GP16 智能设计平台' : 'GP16 Smart Design Platform',
    genTime: lang === 'zh' ? '生成时间' : 'Generated',
    reportNo: lang === 'zh' ? '报告编号' : 'Report No.',
    preparedBy: lang === 'zh' ? '编制单位' : 'Prepared by',
    preparedVal: 'GP16 AI',
    secOverview: lang === 'zh' ? '项目概述与技术亮点' : 'Project Overview & Technical Highlights',
    secTopo: lang === 'zh' ? '系统拓扑图' : 'System Topology',
    secKpi: lang === 'zh' ? '绿色效益指标' : 'Green Impact Metrics',
    secDevices: lang === 'zh' ? '设备清单' : 'Device Inventory',
    secCost: lang === 'zh' ? '累计成本对比（10年）' : 'Cumulative Cost Comparison (10-Year)',
    thName: lang === 'zh' ? '设备名称' : 'Device Name',
    thType: lang === 'zh' ? '类型' : 'Type',
    thPower: lang === 'zh' ? '额定功率' : 'Rated Power',
    thCapacity: lang === 'zh' ? '容量' : 'Capacity',
    thYear: lang === 'zh' ? '年份' : 'Year',
    thTraditional: lang === 'zh' ? '传统模式累计费用' : 'Traditional Cumulative',
    thScheme: lang === 'zh' ? '本方案累计费用(含CAPEX)' : 'Scheme Cumulative (incl. CAPEX)',
    thSavings: lang === 'zh' ? '累计节省' : 'Cum. Savings',
    kpiPv: lang === 'zh' ? '光伏装机容量' : 'PV Installed Capacity',
    kpiGen: lang === 'zh' ? '年发电量' : 'Annual Generation',
    kpiCo2: lang === 'zh' ? '年碳减排量' : 'Annual CO₂ Reduction',
    kpiTrees: lang === 'zh' ? '等效植树量' : 'Equivalent Trees Planted',
    kpiCapex: lang === 'zh' ? '系统总投资' : 'Total System CAPEX',
    kpiPayback: lang === 'zh' ? '简单投资回收期' : 'Simple Payback Period',
    noData: lang === 'zh' ? '暂无分析数据' : 'No analysis data available',
    noDevices: lang === 'zh' ? '（无设备）' : '(No devices)',
    btnPrint: lang === 'zh' ? '🖨️ 打印 / 保存为 PDF' : '🖨️ Print / Save as PDF',
    btnDownload: lang === 'zh' ? '📥 一键下载 PDF' : '📥 Download PDF',
    treesUnit: lang === 'zh' ? '棵' : 'trees',
    yrUnit: lang === 'zh' ? '年' : 'yr',
    pageOf: lang === 'zh' ? '第' : 'Page',
    disclaimer: lang === 'zh' ? '本报告由 GP16 AI 自动生成，仅供设计参考，不构成工程建议。' : 'This report is auto-generated by GP16 AI for design reference only and does not constitute engineering advice.',
  };

  const typeLabel: Record<string, string> = lang === 'zh'
    ? { pv_panel:'光伏板', inverter:'逆变器', battery:'电池/储能', charger:'充电桩', load:'负载', grid:'电网' }
    : { pv_panel:'PV Panel', inverter:'Inverter', battery:'Battery', charger:'EV Charger', load:'Load', grid:'Grid' };

  const deviceRows = (topology.nodes ?? []).map((n: any) => {
    return `<tr><td><strong>${esc(n.data?.label ?? n.id)}</strong></td><td>${esc(typeLabel[n.data?.deviceType] ?? '')}</td><td>${n.data?.ratedPowerKw != null ? `${n.data.ratedPowerKw} kW` : '—'}</td><td>${n.data?.capacityKwh != null ? `${n.data.capacityKwh} kWh` : '—'}</td></tr>`;
  }).join('');

  const s = analysis?.summary;
  const payback = analysis?.simplePaybackYears;
  const costSeries: any[] = analysis?.costSeries ?? [];

  const fmtMoney = (v: number) => `¥${Math.round(v).toLocaleString()}`;
  const kpiItems = s ? [
    { label: L.kpiPv,     value: `${Number(s.pvInstalledKw).toFixed(1)} <small>kW</small>`,    icon: '☀️' },
    { label: L.kpiGen,    value: `${Math.round(s.annualGenerationKwh).toLocaleString()} <small>kWh</small>`, icon: '⚡' },
    { label: L.kpiCo2,    value: `${Number(s.annualCo2SavedTons).toFixed(2)} <small>tCO₂</small>`, icon: '🌱' },
    { label: L.kpiTrees,  value: `${Math.round(s.equivalentTrees).toLocaleString()} <small>${L.treesUnit}</small>`, icon: '🌳' },
    { label: L.kpiCapex,  value: `${fmtMoney(s.totalCapex)}`, icon: '💰' },
    ...(payback != null ? [{ label: L.kpiPayback, value: `${Number(payback).toFixed(1)} <small>${L.yrUnit}</small>`, icon: '📅' }] : []),
  ] : [];

  const kpiHtml = kpiItems.length
    ? `<div class="kpi-grid">${kpiItems.map(k => `
      <div class="kpi-card">
        <div class="kpi-icon">${k.icon}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-val">${k.value}</div>
      </div>`).join('')}</div>`
    : `<div class="empty-state">${L.noData}</div>`;

  const costRows = costSeries.map((p: any) => {
    const saving = p.traditionalCost - p.schemeCost;
    return `<tr>
      <td>${lang === 'zh' ? '第' : 'Y'}${p.year}${lang === 'zh' ? '年' : ''}</td>
      <td>${fmtMoney(p.traditionalCost)}</td>
      <td>${fmtMoney(p.schemeCost)}</td>
      <td class="${saving >= 0 ? 'text-green' : 'text-red'}"><strong>${saving >= 0 ? '+' : ''}${fmtMoney(saving)}</strong></td>
    </tr>`;
  }).join('');

  const dateLocale = lang === 'zh' ? 'zh-CN' : 'en-US';
  const now = new Date();
  const dateStr = now.toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });

  const commentaryHtml = commentary
    ? `<p style="white-space:pre-wrap;margin:0">${esc(commentary)}</p>`
    : `<p class="text-muted">${lang === 'zh' ? '（AI 概述生成中...）' : '(AI overview pending...)'}</p>`;

  const nodeCount = (topology.nodes ?? []).length;
  const edgeCount = (topology.edges ?? []).length;

  const html = `<!doctype html><html lang="${lang === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><title>GP16 — ${L.title}</title>
<style>
  :root {
    --navy: #1a365d; --navy-light: #2a4a7f; --blue: #2b6cb0; --blue-light: #ebf4ff;
    --green: #276749; --green-light: #f0fff4; --red: #c53030; --red-light: #fff5f5;
    --gray-50: #f7fafc; --gray-100: #edf2f7; --gray-200: #e2e8f0; --gray-400: #a0aec0;
    --gray-600: #718096; --gray-700: #4a5568; --gray-900: #1a202c;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${lang === 'zh' ? '"PingFang SC","Microsoft YaHei","Noto Sans SC",Arial,sans-serif' : 'Arial,"Helvetica Neue",sans-serif'};color:var(--gray-900);font-size:10.5pt;line-height:1.55;background:#fff;padding:0}
  #report-content{padding:0 28px 24px}
  .no-print{position:fixed;top:16px;right:16px;z-index:100;display:flex;gap:8px}
  .btn{padding:10px 22px;border:none;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;letter-spacing:.3px;box-shadow:0 2px 8px rgba(0,0,0,.12);transition:all .15s}
  .btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.18)}
  .btn-print{background:var(--navy);color:#fff}.btn-pdf{background:var(--green);color:#fff}

  /* Cover — compact */
  .cover{background:linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);color:#fff;padding:24px 32px 20px;border-radius:10px;margin:0 0 14px 0;position:relative;overflow:hidden;page-break-after:avoid}
  .cover::after{content:'';position:absolute;top:-60px;right:-60px;width:180px;height:180px;background:rgba(255,255,255,.04);border-radius:50%}
  .cover-logo{font-size:10px;letter-spacing:3px;text-transform:uppercase;opacity:.7;margin-bottom:6px}
  .cover h1{font-size:22px;font-weight:800;letter-spacing:.5px;margin-bottom:4px;line-height:1.25}
  .cover .subtitle{font-size:12px;opacity:.8;margin-bottom:0}

  /* Meta bar */
  .meta-bar{display:flex;flex-wrap:wrap;gap:14px 32px;padding:10px 16px;background:var(--gray-50);border-radius:8px;border:1px solid var(--gray-200);margin-bottom:14px;font-size:10px;color:var(--gray-600);page-break-inside:avoid}
  .meta-item{display:flex;flex-direction:column;gap:1px}
  .meta-item .meta-label{font-weight:600;color:var(--gray-400);text-transform:uppercase;letter-spacing:1px;font-size:8px}
  .meta-item .meta-val{color:var(--gray-900);font-size:11px;font-weight:600}

  /* Section headings */
  .sec{font-size:14px;font-weight:700;color:var(--navy);margin:16px 0 6px;padding-bottom:5px;border-bottom:2px solid var(--gray-200);display:flex;align-items:center;gap:8px;page-break-after:avoid}
  .sec .sec-num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:var(--navy);color:#fff;border-radius:5px;font-size:11px;font-weight:800;flex-shrink:0}
  .card{background:var(--gray-50);border:1px solid var(--gray-200);border-radius:8px;padding:12px 14px;margin-bottom:0;page-break-inside:avoid}
  .section-block{page-break-inside:avoid;margin-bottom:14px}

  /* KPI — 3-column grid */
  .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;page-break-inside:avoid}
  .kpi-card{background:#fff;border:1px solid var(--gray-200);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
  .kpi-icon{font-size:17px;line-height:1}
  .kpi-label{font-size:9px;font-weight:600;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px}
  .kpi-val{font-size:18px;font-weight:800;color:var(--navy);line-height:1.15}
  .kpi-val small{font-size:10px;font-weight:500;color:var(--gray-600)}

  /* Tables */
  table{width:100%;border-collapse:collapse;font-size:10px;page-break-inside:avoid}
  thead th{background:var(--navy);color:#fff;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:.5px;padding:8px 10px;text-align:left}
  thead th:first-child{border-radius:5px 0 0 0}thead th:last-child{border-radius:0 5px 0 0}
  tbody td{padding:7px 10px;border-bottom:1px solid var(--gray-100)}
  tbody tr:nth-child(even){background:var(--gray-50)}
  .text-green{color:var(--green)}.text-red{color:var(--red)}.text-muted{color:var(--gray-400)}

  /* SVG topology */
  .svg-wrap{display:flex;justify-content:center;background:#fff;border-radius:6px;padding:8px;overflow:hidden;page-break-inside:avoid}
  .svg-wrap svg{max-width:100%;max-height:480px;height:auto;display:block}

  /* Empty state */
  .empty-state{text-align:center;padding:16px;color:var(--gray-400);font-style:italic}

  /* Footer & disclaimer */
  .report-footer{margin-top:20px;padding-top:12px;border-top:1px solid var(--gray-200);display:flex;justify-content:space-between;font-size:8px;color:var(--gray-400)}
  .disclaimer{margin-top:14px;padding:10px 14px;background:var(--gray-50);border-radius:6px;font-size:8px;color:var(--gray-400);text-align:center;line-height:1.4}

  @media print {
    body{font-size:10pt;padding:0}
    #report-content{padding:0}
    .no-print{display:none !important}
    .cover{margin:0;padding:24px 20px 20px;page-break-after:avoid;border-radius:0}
    .sec{page-break-after:avoid}
    .card{page-break-inside:avoid}
    .kpi-grid{page-break-inside:avoid}
    table{page-break-inside:avoid}
    @page{size:A4;margin:14mm 12mm}
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
</head><body>
  <div class="no-print">
    <button class="btn btn-print" onclick="window.print()">${L.btnPrint}</button>
    <button class="btn btn-pdf" id="btn-download-pdf">${L.btnDownload}</button>
  </div>
  <div id="report-content">

    <div class="section-block">
    <!-- COVER -->
    <div class="cover">
      <div class="cover-logo">GP16</div>
      <h1>${L.title}</h1>
      <div class="subtitle">${L.subtitle}</div>
    </div>

    <!-- META -->
    <div class="meta-bar">
      <div class="meta-item"><span class="meta-label">${L.genTime}</span><span class="meta-val">${dateStr} ${timeStr}</span></div>
      <div class="meta-item"><span class="meta-label">${L.reportNo}</span><span class="meta-val">${esc(reportId)}</span></div>
      <div class="meta-item"><span class="meta-label">${L.preparedBy}</span><span class="meta-val">${L.preparedVal}</span></div>
      <div class="meta-item"><span class="meta-label">${lang === 'zh' ? '设备数量' : 'Devices'}</span><span class="meta-val">${nodeCount} ${lang === 'zh' ? '台设备' : 'devices'}, ${edgeCount} ${lang === 'zh' ? '条连接' : 'connections'}</span></div>
    </div>
    </div>

    <div class="section-block">
    <!-- 1. OVERVIEW -->
    <div class="sec"><span class="sec-num">1</span>${L.secOverview}</div>
    <div class="card">${commentaryHtml}</div>
    </div>

    <div class="section-block">
    <!-- 2. TOPOLOGY -->
    <div class="sec"><span class="sec-num">2</span>${L.secTopo}</div>
    <div class="card"><div class="svg-wrap">${svg}</div></div>
    </div>

    <div class="section-block">
    <!-- 3. KPI -->
    <div class="sec"><span class="sec-num">3</span>${L.secKpi}</div>
    <div class="card">${kpiHtml}</div>
    </div>

    <div class="section-block">
    <!-- 4. DEVICE LIST -->
    <div class="sec"><span class="sec-num">4</span>${L.secDevices}</div>
    <div class="card">
      <table><thead><tr><th>${L.thName}</th><th>${L.thType}</th><th>${L.thPower}</th><th>${L.thCapacity}</th></tr></thead>
      <tbody>${deviceRows || `<tr><td colspan="4" class="empty-state">${L.noDevices}</td></tr>`}</tbody></table>
    </div>
    </div>

    <!-- 5. COST -->
    ${costSeries.length ? `
    <div class="section-block">
    <div class="sec"><span class="sec-num">5</span>${L.secCost}</div>
    <div class="card">
      <table><thead><tr><th>${L.thYear}</th><th>${L.thTraditional}</th><th>${L.thScheme}</th><th>${L.thSavings}</th></tr></thead>
      <tbody>${costRows}</tbody></table>
    </div>
    </div>` : ''}

    <!-- DISCLAIMER -->
    <div class="disclaimer">${L.disclaimer}</div>
    <div class="report-footer">
      <span>GP16 &copy; ${now.getFullYear()}</span>
      <span>${L.pageOf} <span class="page-num"></span></span>
    </div>

  </div>
<script>
  (function() {
    var btn = document.getElementById('btn-download-pdf');
    btn.addEventListener('click', function() {
      btn.textContent = '${lang === 'zh' ? '生成中...' : 'Generating...'}';
      btn.disabled = true;
      var el = document.getElementById('report-content');
      html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: 'Report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, windowHeight: el.scrollHeight },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      }).from(el).save().then(function() {
        btn.textContent = '${L.btnDownload}';
        btn.disabled = false;
      });
    });
  })();
</script>
</body></html>`;

  const outDir = process.env.REPORT_DIR ?? path.resolve(process.cwd(), 'data', 'reports');
  await fs.mkdir(outDir, { recursive: true });
  const htmlPath = path.join(outDir, `${reportId}.html`);
  await fs.writeFile(htmlPath, html, 'utf-8');

  return { reportId, htmlPath };
}

// ── Worker ────────────────────────────────────────────────────────────────────
const worker = new Worker('gp16-jobs', async (job) => {
  if (job.name === 'ping') return { ok: true, at: new Date().toISOString() };

  if (job.name === 'ai_layout') {
    const prompt = String((job.data as any)?.prompt ?? '');
    const llmResult = await callLLM(prompt).catch((e) => {
      console.error('[worker][llm] error', e);
      return null;
    });
    const candidate = llmResult ?? heuristicLayout(prompt);
    const parsed = layoutSchema.safeParse(candidate);
    if (!parsed.success) {
      console.warn('[worker][llm] schema fail, using heuristic');
      return layoutSchema.parse(heuristicLayout(prompt));
    }
    return parsed.data;
  }

  if (job.name === 'report_generate') {
    return generateReport({ ...job.data as any, reportId: String(job.id) });
  }

  throw new Error(`Unknown job: ${job.name}`);
}, { connection });

worker.on('completed', (job) => console.log(`[worker] done  ${job.id} ${job.name}`));
worker.on('failed',    (job, err) => console.error(`[worker] fail  ${job?.id} ${job?.name}`, err.message));
console.log('[worker] started, queue: gp16-jobs');
