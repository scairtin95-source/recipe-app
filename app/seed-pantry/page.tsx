'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../src/lib/supabase';

interface Recipe {
  id: string;
  title: string | null;
  ingredients: string | null;
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {}
  return raw.split('\n').map((s) => s.trim()).filter(Boolean);
}

export default function SeedPantry() {
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [addedCount, setAddedCount] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function run() {
      const { data: recipesData } = await supabase
        .from('recipes')
        .select('id, title, ingredients');

      const { data: existing } = await supabase
        .from('pantry_items')
        .select('name');

      const existingNames = new Set(
        (existing || []).map((i: any) => i.name.trim().toLowerCase())
      );

      const recipes = (recipesData || []) as Recipe[];
      setTotal(recipes.length);

      for (const recipe of recipes) {
        const ingredientLines = parseList(recipe.ingredients);
        if (ingredientLines.length === 0) {
          setProcessed((p) => p + 1);
          continue;
        }

        try {
          const res = await fetch('/api/extract-pantry-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ingredients: ingredientLines }),
          });
          const json = await res.json();
          const items = json.items || [];

          const newItems = items.filter(
            (item: any) => !existingNames.has(item.name.trim().toLowerCase())
          );

          for (const item of newItems) {
            existingNames.add(item.name.trim().toLowerCase());
          }

          if (newItems.length > 0) {
            await supabase.from('pantry_items').insert(
              newItems.map((item: any) => ({
                name: item.name,
                category: item.category,
                have_it: false,
              }))
            );
            setAddedCount((c) => c + newItems.length);
            setLog((prev) => [
              ...prev,
              `${recipe.title || 'Untitled'} — added ${newItems.length} new item${newItems.length === 1 ? '' : 's'}`,
            ]);
          }
        } catch (err) {
          setLog((prev) => [...prev, `${recipe.title || 'Untitled'} — error`]);
        }

        setProcessed((p) => p + 1);
      }
      setDone(true);
    }

    run();
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24, fontFamily: 'Georgia, serif' }}>
      <h2>Seeding pantry from recipes</h2>

      {total === 0 && !done && <p>Loading recipes…</p>}

      {total > 0 && (
        <>
          <p style={{ fontFamily: 'system-ui, sans-serif', color: '#5a6b4a' }}>
            {processed} of {total} recipes processed
          </p>
          {done && (
            <p style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
              Done — {addedCount} unique pantry items added
            </p>
          )}
          <div style={{ marginTop: 16, maxHeight: 500, overflowY: 'auto', border: '1px solid #e0dbd2', borderRadius: 8 }}>
            {log.map((line, i) => (
              <div key={i} style={{
                padding: '8px 12px', borderBottom: '1px solid #f0ede6',
                fontFamily: 'system-ui, sans-serif', fontSize: '0.85rem', color: '#5a6b4a'
              }}>
                {line}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}