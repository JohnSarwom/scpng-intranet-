import React, { useState } from 'react';
import ChristmasEventGate from './ChristmasEventGate';

/**
 * Developer-only page (/dev/christmas-event) for rehearsing the invitation
 * without signing in or touching SharePoint. Not registered in production builds.
 */
export default function ChristmasEventPreview() {
  const [run, setRun] = useState(0);
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#f8fafc,#e2e8f0)', padding: 32, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Christmas invitation preview</h1>
      <p style={{ color: '#475569', maxWidth: 620, marginTop: 8 }}>
        This page plays the invitation the way staff will see it when they open the intranet. Answers are kept in memory
        only and are not saved to SharePoint.
      </p>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, background: '#0f172a', color: '#fff' }}
      >
        Play again
      </button>
      <ChristmasEventGate key={run} demo />
    </div>
  );
}
