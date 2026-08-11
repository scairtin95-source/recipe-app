'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../src/lib/supabase';

interface Recipe {
  id: string;
  title: string | null;
  ingredients: string | null;
  steps: string | null;
}

interface ResultRow {
  title: string;
  status: 'translated' | 'already_english' | 'error';
}

export default function FixTranslations() {
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
        .select('id, title, ingredients, steps');

      if (error || !data) {
        setDone(true);
        return;
      }

      const recipes = data as Recipe[];
      setTotal(recipes.length);

      for (const recipe of recipes) {
        let status: ResultRow['status'] = 'already_english';
        try {
          const res = await fetch('/api/translate-recipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: recipe.title,
              ingredients: recipe.ingredients,
              steps: recipe.steps,
            }),
          });
          const json = await res.json();
          if (json.changed) {
            await supabase
              .from('recipes')
              .update({
                title: json.title,
                ingredients: JSON.stringify(json.ingredients),
                steps: JSON.stringify(json.steps),
              })
              .eq('id', recipe.id);
            status = 'translated';
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

  const translatedCount = results.filter((r) => r.status === 'translated').length;
  const alreadyCount = results.filter((r) => r.status === 'already_english').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24, fontFamily: 'Georgia, serif' }}>
      <h2>Translating recipes to English</h2>

      {total === 0 && !done && <p>Loading recipes…</p>}
      {total === 0 && done && <p>No recipes found.</p>}

      {total > 0 && (
        <>
          <p style={{ fontFamily: 'system-ui, sans-serif', color: '#5a6b4a' }}>
            {processed} of {total} processed
          </p>

          {done && (
            <p style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
              Done — {translatedCount} translated, {alreadyCount} already English, {errorCount} errors
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
                  color: r.status === 'translated' ? '#5a6b4a' : r.status === 'error' ? '#b85c3a' : '#999',
                }}
              >
                <span>{r.title}</span>
                <span>
                  {r.status === 'translated' ? '✓ translated' : r.status === 'error' ? '✗ error' : '— already English'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}