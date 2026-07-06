'use client';

interface MatrixItem {
  id: string;
  name: string;
  domain: string;
  required: number;
  avgCurrent: number;
  metPct: number;
  metCount: number;
  totalCount: number;
}

interface Props {
  competencies: MatrixItem[];
}

function GapBar({ current, required }: { current: number; required: number }) {
  const fillPct = required > 0 ? Math.min((current / required) * 100, 100) : 100;
  const color = fillPct >= 100 ? '#16a34a' : fillPct >= 60 ? '#f59e0b' : '#dc2626';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${fillPct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] text-gray-500 w-12 text-right shrink-0">
        {current.toFixed(1)}/{required}
      </span>
    </div>
  );
}

export function CompetencyMatrix({ competencies }: Props) {
  if (!competencies.length) {
    return (
      <div className="flex items-center justify-center h-32 text-[12px] text-gray-400">
        Không có dữ liệu năng lực
      </div>
    );
  }

  // Group by domain
  const domainMap = new Map<string, MatrixItem[]>();
  for (const c of competencies) {
    if (!domainMap.has(c.domain)) domainMap.set(c.domain, []);
    domainMap.get(c.domain)!.push(c);
  }

  return (
    <div className="space-y-4">
      {Array.from(domainMap.entries()).map(([domain, items]) => {
        const domainMetPct = Math.round(
          items.reduce((s, c) => s + c.metPct, 0) / items.length,
        );
        const domainColor = domainMetPct >= 80 ? 'text-green-600' : domainMetPct >= 50 ? 'text-amber-600' : 'text-red-500';
        return (
          <div key={domain} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
              <span className="text-[11px] font-semibold text-gray-700">{domain}</span>
              <span className={`text-[11px] font-semibold ${domainColor}`}>{domainMetPct}% đạt</span>
            </div>
            <div className="divide-y divide-gray-100">
              {items
                .sort((a, b) => a.metPct - b.metPct) // worst first
                .map((comp) => {
                  const badge =
                    comp.metPct >= 80
                      ? { label: 'Tốt', cls: 'bg-green-50 text-green-700' }
                      : comp.metPct >= 50
                      ? { label: 'Đang PT', cls: 'bg-amber-50 text-amber-700' }
                      : { label: 'Cần hỗ trợ', cls: 'bg-red-50 text-red-600' };
                  return (
                    <div key={comp.id} className="px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] text-gray-700 font-medium">{comp.name}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {comp.metCount}/{comp.totalCount} NV đạt
                          </span>
                        </div>
                      </div>
                      <GapBar current={comp.avgCurrent} required={comp.required} />
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
