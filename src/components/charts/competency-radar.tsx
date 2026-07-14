'use client';

import { useState } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { CompetencyRadarData, FrameworkRadarData, RadarDomain } from '@/services/competency-radar.service';

interface Props {
  data: CompetencyRadarData;
  showDetails?: boolean;
}

function ReadinessRing({ score }: { score: number }) {
  const color = score >= 80 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#dc2626';
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="44" textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="600" fill={color}>
          {score}%
        </text>
      </svg>
      <p className="text-[10px] text-gray-500 mt-1">Sẵn sàng</p>
    </div>
  );
}

interface RadarPanelProps {
  readinessScore: number;
  metCount: number;
  totalCompetencies: number;
  radarAxes: { subject: string; required: number; current: number; fullMark: number }[];
  domains: RadarDomain[];
  showDetails: boolean;
  headerExtra?: React.ReactNode;
}

function RadarPanel({ readinessScore, metCount, totalCompetencies, radarAxes, domains, showDetails, headerExtra }: RadarPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        <ReadinessRing score={readinessScore} />
        <div className="space-y-1">
          {headerExtra}
          <div className="flex gap-4 mt-1">
            <div className="text-center">
              <div className="text-[16px] font-semibold text-green-600">{metCount}</div>
              <div className="text-[9px] text-gray-400">Đạt yêu cầu</div>
            </div>
            <div className="text-center">
              <div className="text-[16px] font-semibold text-red-500">
                {totalCompetencies - metCount}
              </div>
              <div className="text-[9px] text-gray-400">Cần phát triển</div>
            </div>
            <div className="text-center">
              <div className="text-[16px] font-semibold text-gray-700">{totalCompetencies}</div>
              <div className="text-[9px] text-gray-400">Tổng năng lực</div>
            </div>
          </div>
        </div>
      </div>

      {radarAxes.length >= 3 ? (
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarAxes}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6b7280' }} />
            {/* domain 0–1: required always fills to outer edge, current fills proportionally */}
            <PolarRadiusAxis
              angle={30}
              domain={[0, 1]}
              tickCount={6}
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
            {/* Outer boundary = target/requirement for this position */}
            <Radar
              name="Mục tiêu"
              dataKey="required"
              stroke="#185FA5"
              fill="#185FA5"
              fillOpacity={0.06}
              strokeDasharray="4 2"
              strokeWidth={1.5}
            />
            {/* Actual level — lights up within the target boundary */}
            <Radar
              name="Hiện tại"
              dataKey="current"
              stroke="#16a34a"
              fill="#16a34a"
              fillOpacity={0.35}
              strokeWidth={2}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              formatter={(value) => <span style={{ color: '#374151' }}>{value}</span>}
            />
            <Tooltip
              formatter={(value: number, name: string, props: { payload?: { currentRaw?: number; requiredRaw?: number } }) => {
                const p = props.payload ?? {};
                if (name === 'Mục tiêu') {
                  return [`Yêu cầu: ${(p.requiredRaw ?? 0).toFixed(1)} / 5`, name];
                }
                if (name === 'Hiện tại') {
                  return [`${(p.currentRaw ?? 0).toFixed(1)} / ${(p.requiredRaw ?? 0).toFixed(1)} (${Math.round(value * 100)}%)`, name];
                }
                return [`${Math.round(value * 100)}%`, name];
              }}
              labelStyle={{ fontSize: '11px', fontWeight: 600 }}
              contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      ) : radarAxes.length > 0 ? (
        /* Fewer than 3 axes → bar chart fallback */
        <div className="space-y-2">
          {radarAxes.map((axis) => {
            const pct = Math.round(axis.current * 100);
            return (
              <div key={axis.subject} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-700 font-medium">{axis.subject}</span>
                  <span className={pct >= 100 ? 'text-green-600 font-semibold' : pct >= 60 ? 'text-amber-600' : 'text-red-500'}>
                    {pct}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-400' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400">
                  Hiện tại: {axis.currentRaw.toFixed(1)} / Yêu cầu: {axis.requiredRaw.toFixed(1)}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-[12px] text-gray-400 py-8">Không có dữ liệu biểu đồ</p>
      )}

      {showDetails && domains.map((domain) => (
        <div key={domain.name} className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
            <span className="text-[11px] font-semibold text-gray-700">{domain.name}</span>
            <span className="text-[10px] text-gray-500">
              {domain.currentAvg.toFixed(1)} / {domain.requiredAvg.toFixed(1)}
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {domain.competencies.map((comp) => (
              <div key={comp.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-700 truncate">{comp.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-1.5 flex-1 rounded-full ${
                          lvl <= comp.current
                            ? lvl <= comp.required
                              ? 'bg-green-400'
                              : 'bg-blue-400'
                            : lvl <= comp.required
                            ? 'bg-red-200'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[11px] font-medium ${
                    comp.current >= comp.required ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {comp.current}/{comp.required}
                  </span>
                  {comp.source !== 'none' && (
                    <p className="text-[9px] text-gray-400 capitalize">{comp.source.toLowerCase()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CompetencyRadarChart({ data, showDetails = false }: Props) {
  const hasMultiFramework = data.frameworkBreakdown && data.frameworkBreakdown.length > 1;
  // 'composite' = weighted overview; frameworkId = specific framework tab
  const [activeTab, setActiveTab] = useState<'composite' | string>('composite');

  if (!hasMultiFramework) {
    // Single framework — existing behavior
    if (!data.radarAxes.length) {
      return (
        <div className="flex items-center justify-center h-40 text-[12px] text-gray-400">
          {data.positionTitle
            ? 'Khung năng lực chưa được gán cho vị trí này'
            : 'Chưa có vị trí công việc — không có dữ liệu năng lực'}
        </div>
      );
    }

    return (
      <RadarPanel
        readinessScore={data.readinessScore}
        metCount={data.metCount}
        totalCompetencies={data.totalCompetencies}
        radarAxes={data.radarAxes}
        domains={data.domains}
        showDetails={showDetails}
        headerExtra={
          <>
            <p className="text-[13px] font-semibold text-gray-800">{data.fullName}</p>
            {data.positionTitle && (
              <p className="text-[11px] text-gray-500">Vị trí: {data.positionTitle}</p>
            )}
            {data.frameworkName && (
              <p className="text-[11px] text-gray-500">Framework: {data.frameworkName}</p>
            )}
          </>
        }
      />
    );
  }

  // Multi-framework — tab UI
  const fwMap = new Map<string, FrameworkRadarData>(
    data.frameworkBreakdown.map((fw) => [fw.frameworkId, fw]),
  );

  const activeFw = activeTab === 'composite' ? null : fwMap.get(activeTab) ?? null;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('composite')}
          className={`px-3 py-1.5 text-[11px] font-medium rounded-t-lg transition-colors ${
            activeTab === 'composite'
              ? 'bg-primary text-white'
              : 'text-gray-500 hover:text-primary hover:bg-primary-tint'
          }`}
        >
          Tổng hợp {data.readinessScore}%
        </button>
        {data.frameworkBreakdown.map((fw) => (
          <button
            key={fw.frameworkId}
            onClick={() => setActiveTab(fw.frameworkId)}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-t-lg transition-colors ${
              activeTab === fw.frameworkId
                ? 'bg-primary text-white'
                : 'text-gray-500 hover:text-primary hover:bg-primary-tint'
            }`}
          >
            {fw.frameworkName} {fw.readinessScore}%
            {fw.isPrimary && (
              <span className="ml-1 text-[9px] opacity-70">★</span>
            )}
          </button>
        ))}
      </div>

      {/* Composite tab */}
      {activeTab === 'composite' && (
        <RadarPanel
          readinessScore={data.readinessScore}
          metCount={data.metCount}
          totalCompetencies={data.totalCompetencies}
          radarAxes={data.radarAxes}  // primary framework axes for composite view
          domains={data.domains}       // all domains merged
          showDetails={showDetails}
          headerExtra={
            <>
              <p className="text-[13px] font-semibold text-gray-800">{data.fullName}</p>
              {data.positionTitle && (
                <p className="text-[11px] text-gray-500">Vị trí: {data.positionTitle}</p>
              )}
              <p className="text-[11px] text-gray-500">
                Tổng hợp {data.frameworkBreakdown.length} khung năng lực (trọng số)
              </p>
            </>
          }
        />
      )}

      {/* Per-framework tab */}
      {activeFw && (
        <RadarPanel
          readinessScore={activeFw.readinessScore}
          metCount={activeFw.metCount}
          totalCompetencies={activeFw.totalCompetencies}
          radarAxes={activeFw.radarAxes}
          domains={activeFw.domains}
          showDetails={showDetails}
          headerExtra={
            <>
              <p className="text-[13px] font-semibold text-gray-800">{data.fullName}</p>
              {data.positionTitle && (
                <p className="text-[11px] text-gray-500">Vị trí: {data.positionTitle}</p>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-gray-500">Framework: {activeFw.frameworkName}</p>
                <span className="text-[9px] text-gray-400">
                  (trọng số {(activeFw.weight * 100).toFixed(0)}%)
                </span>
              </div>
            </>
          }
        />
      )}
    </div>
  );
}
