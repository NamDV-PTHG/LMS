'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface PositionUserRadarProps {
  /** Full name of the user */
  userName: string;
  /** Employee code (optional) */
  employeeCode?: string | null;
  /** Overall readiness % 0–100 */
  readinessPct: number;
  /** One entry per competency domain */
  axes: {
    domainName: string;
    requiredAvg: number;  // 0–5 raw required level
    currentAvg: number;   // 0–5 raw current level
  }[];
}

const READINESS_COLOR = (pct: number) =>
  pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626';

/** Truncate long domain names to keep axis labels readable */
function shortLabel(name: string, max = 14): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

export function PositionUserRadar({
  userName,
  employeeCode,
  readinessPct,
  axes,
}: PositionUserRadarProps) {
  if (axes.length < 3) {
    return (
      <div className="flex items-center justify-center h-40 text-[11px] text-gray-400">
        Cần ít nhất 3 domain để vẽ radar
      </div>
    );
  }

  const color = READINESS_COLOR(readinessPct);

  // Normalize to 0–100 for the chart
  // required always = 100 (outer boundary), current = (current/required)*100 capped at 100
  const chartData = axes.map((a) => ({
    subject: shortLabel(a.domainName),
    fullSubject: a.domainName,
    required: 100,                                                           // outer boundary
    current: a.requiredAvg > 0
      ? Math.min(Math.round((a.currentAvg / a.requiredAvg) * 100), 100)
      : 0,
    currentRaw: a.currentAvg,
    requiredRaw: a.requiredAvg,
  }));

  // Avatar initials
  const initials = userName
    .split(' ')
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      {/* User label — styled like the image pill labels */}
      <div className="flex items-center gap-2 self-start pl-1">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
        <div>
          <p className="text-[12px] font-semibold text-gray-800 leading-tight">{userName}</p>
          {employeeCode && (
            <p className="text-[10px] text-gray-400 leading-tight">#{employeeCode}</p>
          )}
        </div>
        {/* Readiness ring (small inline) */}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[11px] font-medium" style={{ color }}>
            {readinessPct}%
          </span>
          <ReadinessMini pct={readinessPct} color={color} />
        </div>
      </div>

      {/* Radar chart */}
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid
            stroke="#e5e7eb"
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 500 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tickCount={6}
            tick={{ fontSize: 8, fill: '#d1d5db' }}
            tickFormatter={(v: number) => v === 0 ? '' : `${v}`}
            axisLine={false}
          />

          {/* Required level — dashed outer boundary */}
          <Radar
            name="Yêu cầu"
            dataKey="required"
            stroke="#185FA5"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            fill="#185FA5"
            fillOpacity={0.05}
          />

          {/* User's current level — solid colored polygon */}
          <Radar
            name="Hiện tại"
            dataKey="current"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.22}
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: color }}
          />

          <Tooltip
            formatter={(
              value: number,
              name: string,
              props: { payload?: { currentRaw?: number; requiredRaw?: number } },
            ) => {
              const p = props.payload ?? {};
              if (name === 'Yêu cầu') {
                return [`Mức yêu cầu: ${(p.requiredRaw ?? 0).toFixed(1)} / 5`, name];
              }
              if (name === 'Hiện tại') {
                return [
                  `${(p.currentRaw ?? 0).toFixed(1)} / ${(p.requiredRaw ?? 0).toFixed(1)} (${value}%)`,
                  name,
                ];
              }
              return [`${value}%`, name];
            }}
            labelFormatter={(label: string, payload) => {
              const full = (payload?.[0]?.payload as { fullSubject?: string })?.fullSubject;
              return full ?? label;
            }}
            contentStyle={{
              fontSize: '11px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
            labelStyle={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Domain detail pills */}
      <div className="w-full grid grid-cols-2 gap-1 px-1">
        {axes.map((a) => {
          const pct = a.requiredAvg > 0
            ? Math.min(Math.round((a.currentAvg / a.requiredAvg) * 100), 100)
            : 0;
          const barColor =
            pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626';
          return (
            <div key={a.domainName} className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-600 truncate flex-1 min-w-0" title={a.domainName}>
                {shortLabel(a.domainName, 16)}
              </span>
              <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
              <span className="text-[9px] text-gray-400 w-6 text-right flex-shrink-0">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Tiny SVG ring showing readiness % */
function ReadinessMini({ pct, color }: { pct: number; color: string }) {
  const r = 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <circle cx="13" cy="13" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle
        cx="13" cy="13" r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 13 13)"
      />
    </svg>
  );
}
