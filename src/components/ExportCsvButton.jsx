import React from 'react';

export function ExportCsvButton({ data, filename, columns }) {
  const handleExport = () => {
    if (!data || data.length === 0) return;
    const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }));
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Quote (and escape embedded quotes) whenever the value could otherwise
      // be misread as multiple fields/rows by a CSV parser.
      if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const header = cols.map(c => escapeCsv(c.label)).join(',');
    const rows = data.map(row =>
      cols.map(c => escapeCsv(row[c.key])).join(',')
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
