import { Alert, Card, Collapse, Divider, InputNumber, Spin, Statistic, Tag, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTopologyStore } from '@/state/topologyStore';
import { useConfigStore } from '@/state/configStore';
import { useDebouncedAnalysis } from '@/hooks/useDebouncedAnalysis';

export function AnalyticsPanel() {
  const { t } = useTranslation();
  const nodes = useTopologyStore((s) => s.nodes);
  const { config, setConfig } = useConfigStore();
  const { data, loading, error } = useDebouncedAnalysis(1200);

  const chartOption = useMemo(() => {
    const series = data?.costSeries ?? [];
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => `¥${Number(v).toLocaleString()}` },
      legend: { data: [t('traditional'), t('scheme')], top: 0, textStyle: { fontSize: 11 } },
      grid: { top: 32, bottom: 28, left: 70, right: 10 },
      xAxis: { type: 'category', data: series.map((p) => `${p.year}`), name: t('years'), nameLocation: 'end' },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}` },
      },
      series: [
        { name: t('traditional'), type: 'line', data: series.map((p) => p.traditionalCost), smooth: true, itemStyle: { color: '#1677ff' }, areaStyle: { opacity: 0.06 } },
        { name: t('scheme'),      type: 'line', data: series.map((p) => p.schemeCost),      smooth: true, itemStyle: { color: '#52c41a' }, areaStyle: { opacity: 0.06 } },
      ],
    };
  }, [data, t]);

  const payback = data?.simplePaybackYears;

  return (
    <div style={{ padding: '12px 10px', overflowY: 'auto', height: '100%' }}>
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
        {t('analysis')}
      </Typography.Title>

      {/* KPI summary */}
      <Card size="small" style={{ marginBottom: 10 }}>
        {error && <Alert type="error" message={t('analysisFail')} description={error} style={{ marginBottom: 8 }} />}
        {nodes.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('noDevice')}</Typography.Text>
        ) : (
          <Spin spinning={loading}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Statistic title={`${t('pvInstalled')} (kW)`}   value={Number((data?.summary.pvInstalledKw ?? 0).toFixed(1))} />
              <Statistic title={`${t('annualGen')} (kWh)`}    value={data ? Math.round(data.summary.annualGenerationKwh).toLocaleString() : '-'} />
              <Statistic title={`${t('co2Saved')} (tCO₂)`}   value={data ? Number(data.summary.annualCo2SavedTons.toFixed(2)) : '-'} />
              <Statistic title={`${t('trees')} (棵)`}         value={data ? Math.round(data.summary.equivalentTrees).toLocaleString() : '-'} />
              <Statistic title={`${t('totalCapex')} (¥)`}     value={data ? `¥${Math.round(data.summary.totalCapex).toLocaleString()}` : '-'} />
            </div>
            <div style={{ marginTop: 10 }}>
              {payback != null && (
                <span>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('payback')}：</Typography.Text>
                  <Tag color={payback <= 8 ? 'success' : payback <= 15 ? 'warning' : 'error'}>
                    {payback.toFixed(1)} {t('years')}
                  </Tag>
                </span>
              )}
              {payback == null && data && (
                <Tag color="default" style={{ fontSize: 11 }}>{t('paybackNA')}</Tag>
              )}
            </div>
          </Spin>
        )}
      </Card>

      {/* Cost chart */}
      <Card size="small" title={t('costChart')} style={{ marginBottom: 10 }}>
        {data ? (
          <ReactECharts option={chartOption} style={{ height: 220 }} />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('noDevice')}</Typography.Text>
        )}
      </Card>

      {/* Config panel */}
      <Collapse size="small" items={[{
        key: 'cfg',
        label: t('config'),
        children: (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
            {([
              ['electricityPricePerKwh', t('elecPrice'),    0.01, 0.01],
              ['fullLoadHoursPerYear',   t('fullLoadHours'), 100,  50],
              ['gridEmissionFactor',     t('emissionFactor'),0.01, 0.01],
              ['performanceRatio',       t('perfRatio'),     0.01, 0.01],
              ['pvUnitCostPerKw',        t('pvCost'),        10,   50],
              ['inverterUnitCostPerKw',  t('invCost'),       10,   10],
              ['battUnitCostPerKwh',     t('battCost'),      10,   10],
            ] as [keyof typeof config, string, number, number][]).map(([key, label, min, step]) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{label}</div>
                <InputNumber
                  size="small" min={min} step={step}
                  value={(config as any)[key]}
                  onChange={(v) => v != null && setConfig({ [key]: v })}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>
        ),
      }]} />
    </div>
  );
}
