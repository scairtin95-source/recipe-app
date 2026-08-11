'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../src/lib/supabase';

interface Recipe {
  id: string;
  title: string | null;
  source_url: string | null;
}

interface ResultRow {
  title: string;
  status: 'found' | 'not_found' | 'error';
}

export default function FixImages() {
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [done, setDone] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function run() {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, source_url')
        .or('image.is.null,image.eq.')
        .not('source_url', 'is', null);

      if (error || !data) {
        setDone(true);
        return;
      }

      const recipes = data as Recipe[];
      setTotal(recipes.length);

      for (const recipe of recipes) {
        let status: ResultRow['status'] = 'not_found';
        try {
          const res = await fetch('/api/find-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_url: recipe.source_url }),
          });
          const json = await res.json();
          if (json.image) {
            await supabase.from('recipes').update({ image: json.image }).eq('id', recipe.id);
            status = 'found';
          }
        } catch {
          status = 'error';
        }
        setResults((prev) => [...prev, { title: recipe.title || 'Untitled', status }]);
        setProcessed((p) => p + 1);
      }
      setDone(true);
    }

    run();
  }, []);

  const foundCount = results.filter((r) => r.status === 'found').length;
  const notFoundCount = results.filter((r) => r.status !== 'found').length;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24, fontFamily: 'Georgia, serif' }}>
      <h2>Fixing missing images</h2>

      {total === 0 && !done && <p>Loading recipes…</p>}
      {total === 0 && done && <p>No recipes are missing images. 🎉</p>}

      {total > 0 && (
        <>
          <p style={{ fontFamily: 'system-ui, sans-serif', color: '#5a6b4a' }}>
            {processed} of {total} processed
          </p>

          {done && (
            <p style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
              Done — {foundCount} image{foundCount === 1 ? '' : 's'} found, {notFoundCount} not found
            </p>
          )}

          <div style={{ marginTop: 16, maxHeight: 500, overflowY: 'auto', border: '1px solid #e0dbd2', borderRadius: 8 }}>
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #f0ede6',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '0.9rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: r.status === 'found' ? '#5a6b4a' : '#b85c3a',
                }}
              >
                <span>{r.title}</span>
                <span>{r.status === 'found' ? '✓ found' : r.status === 'error' ? '✗ error' : '✗ not found'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}