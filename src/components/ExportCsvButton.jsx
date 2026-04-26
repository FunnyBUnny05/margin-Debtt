import React from 'react';

/**
 * ExportCsvButton
 * @param {Array}  data     - Array of objects to export
 * @param {string} filename - Download filename (without .csv)
 * @param {Array}  columns  - Optional: [{ key, label }] to control column order/names.
 *                            If omitted, all keys from first row are used.
 */
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
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
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
      style={{
        background: 'transparent',
        color: '#4B5563',
        border: '1px solid #1F2937',
        padding: '2px 7px',
        fontSize: '9px',
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        fontWeight: '700',
        letterSpacing: '0.3px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'color 0.1s, border-color 0.1s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = '#10B981';
        e.currentTarget.style.borderColor = '#10B981';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = '#4B5563';
        e.currentTarget.style.borderColor = '#1F2937';
      }}
    >
      ↓ CSV
    </button>
  );
}

export default ExportCsvButton;
