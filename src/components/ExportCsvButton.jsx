import React from 'react';

export function ExportCsvButton({ data, filename, columns }) {
  const handleExport = () => {
    if (!data || data.length === 0) return;
    const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }));
    const header = cols.map(c => `"${c.label}"`).join(',');
    const rows = data.map(row =>
      cols.map(c => {
        const val = row[c.key];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return val;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      title={`Export ${filename}.csv`}
      className="chart-btn outline"
    >
      ↓ CSV
    </button>
  );
}

export default ExportCsvButton;
