/**
 * CreditMortgage/DataIngestion.jsx
 * ──────────────────────────────────
 * CSV / JSON drop-zone to override hardcoded data.
 * Accepts files or pasted text matching DATA_SCHEMA.
 */

import React, { useState, useRef, useCallback } from 'react';
import { loadFromCSV, loadFromJSON } from './utils';
import { DATA_SCHEMA } from './data';

const BLUE = '#58A6FF';

export function DataIngestion({ onDataLoaded }) {
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode]             = useState('drop'); // 'drop' | 'paste'
  const [pasteText, setPasteText]   = useState('');
  const [status, setStatus]         = useState(null);  // { type: 'success'|'error', message }
  const fileRef = useRef(null);

  const processText = useCallback((text, filename) => {
    try {
      let parsed;
      const isJson = filename?.endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[');
      if (isJson) {
        parsed = loadFromJSON(JSON.parse(text));
      } else {
        parsed = loadFromCSV(text);
      }
      setStatus({ type: 'success', message: `✓ Loaded ${parsed.length} rows from ${filename ?? 'pasted text'}.` });
      onDataLoaded(parsed);
    } catch (err) {
      setStatus({ type: 'error', message: `✕ ${err.message}` });
    }
  }, [onDataLoaded]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => processText(e.target.result, file.name);
    reader.readAsText(file);
  }, [processText]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const schemaFields = DATA_SCHEMA.quarterly;

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '12px', borderBottom: '1px solid #21262D' }}>
        {['drop', 'paste', 'schema'].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '6px 14px',
              background: mode === m ? '#161B22' : 'transparent',
              color: mode === m ? BLUE : '#6E7681',
              border: 'none',
              borderBottom: mode === m ? `2px solid ${BLUE}` : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: '700',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              transition: 'all 0.1s',
            }}
          >
            {m === 'drop' ? '⬆ FILE' : m === 'paste' ? '📋 PASTE JSON/CSV' : '📐 SCHEMA'}
          </button>
        ))}
      </div>

      {/* File drop zone */}
      {mode === 'drop' && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? BLUE : '#30363D'}`,
            padding: '32px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(88,166,255,0.05)' : 'transparent',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
          <div style={{ color: isDragging ? BLUE : '#8B949E', marginBottom: '4px' }}>
            Drop CSV or JSON file here
          </div>
          <div style={{ color: '#6E7681', fontSize: '10px' }}>
            or click to browse
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.txt"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Paste zone */}
      {mode === 'paste' && (
        <div>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={`Paste CSV or JSON...\nExample CSV:\nquarter,rejectionRate,delinquency90,fragility,utilization\nQ4 2025,41.8,3.74,38.3,27.8`}
            rows={8}
            style={{
              width: '100%',
              background: '#161B22',
              border: '1px solid #30363D',
              color: '#C9D1D9',
              padding: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              resize: 'vertical',
              outline: 'none',
              lineHeight: '1.6',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => processText(pasteText, null)}
            disabled={!pasteText.trim()}
            style={{
              marginTop: '8px',
              padding: '7px 18px',
              background: pasteText.trim() ? BLUE : '#21262D',
              color: pasteText.trim() ? '#0D1117' : '#6E7681',
              border: 'none',
              cursor: pasteText.trim() ? 'pointer' : 'default',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '0.5px',
              transition: 'all 0.15s',
            }}
          >
            LOAD DATA
          </button>
        </div>
      )}

      {/* Schema reference */}
      {mode === 'schema' && (
        <div>
          <div style={{ color: '#8B949E', marginBottom: '10px', fontSize: '10px' }}>
            Expected fields for quarterly time-series data:
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #21262D' }}>
                {['FIELD', 'TYPE', 'EXAMPLE', 'DESCRIPTION'].map(h => (
                  <th key={h} style={{
                    padding: '4px 8px', textAlign: 'left',
                    color: '#6E7681', fontWeight: '700', letterSpacing: '0.5px',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schemaFields.map(f => (
                <tr key={f.field} style={{ borderBottom: '1px solid #161B22' }}>
                  <td style={{ padding: '6px 8px', color: BLUE, fontWeight: '600' }}>{f.field}</td>
                  <td style={{ padding: '6px 8px', color: '#56D364' }}>{f.type}</td>
                  <td style={{ padding: '6px 8px', color: '#D29922' }}>{String(f.example)}</td>
                  <td style={{ padding: '6px 8px', color: '#8B949E' }}>{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '10px', color: '#6E7681', fontSize: '9px', lineHeight: '1.6' }}>
            Missing fields will default to 0. Column headers are matched case-insensitively and by substring.
            Accepts both .csv and .json file formats.
          </div>
        </div>
      )}

      {/* Status message */}
      {status && (
        <div style={{
          marginTop: '10px',
          padding: '8px 12px',
          background: status.type === 'success' ? 'rgba(35,134,54,0.15)' : 'rgba(248,81,73,0.12)',
          border: `1px solid ${status.type === 'success' ? '#238636' : '#F85149'}`,
          color: status.type === 'success' ? '#56D364' : '#F85149',
          fontSize: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{status.message}</span>
          <button
            onClick={() => setStatus(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '12px' }}
          >✕</button>
        </div>
      )}
    </div>
  );
}
