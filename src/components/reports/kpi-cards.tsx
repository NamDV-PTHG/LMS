import React from 'react';

interface KpiCard {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'default' | 'green' | 'blue' | 'orange' | 'red';
}

const colorMap = {
  default: 'bg-white border-gray-200',
  green:   'bg-green-50 border-green-200',
  blue:    'bg-blue-50 border-blue-200',
  orange:  'bg-orange-50 border-orange-200',
  red:     'bg-red-50 border-red-200',
};

const valueColorMap = {
  default: 'text-gray-900',
  green:   'text-green-700',
  blue:    'text-blue-700',
  orange:  'text-orange-700',
  red:     'text-red-700',
};

export function KpiCards({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const c = card.color ?? 'default';
        return (
          <div key={i} className={`rounded-xl border p-5 ${colorMap[c]}`}>
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${valueColorMap[c]}`}>{card.value}</p>
            {card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}
