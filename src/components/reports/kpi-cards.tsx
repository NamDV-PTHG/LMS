import React from 'react';

interface KpiCard {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'default' | 'green' | 'blue' | 'orange' | 'red';
}

const colorMap = {
  default: 'bg-surface border-default',
  green:   'bg-green-50 border-green-200',
  blue:    'bg-blue-50 border-blue-200',
  orange:  'bg-orange-50 border-orange-200',
  red:     'bg-red-50 border-red-200',
};

const valueColorMap = {
  default: 'text-content',
  green:   'text-green-700',
  blue:    'text-blue-700',
  orange:  'text-orange-700',
  red:     'text-red-700',
};

const subColorMap = {
  default: 'text-subtle',
  green:   'text-green-600',
  blue:    'text-blue-600',
  orange:  'text-orange-600',
  red:     'text-red-500',
};

export function KpiCards({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => {
        const c = card.color ?? 'default';
        return (
          <div key={i} className={`rounded-xl border shadow-card p-4 ${colorMap[c]}`}>
            <p className={`text-[11px] mb-1 ${subColorMap[c]}`}>{card.label}</p>
            <p className={`text-[22px] font-bold leading-tight ${valueColorMap[c]}`}>{card.value}</p>
            {card.sub && <p className={`text-[11px] mt-1 ${subColorMap[c]}`}>{card.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}
