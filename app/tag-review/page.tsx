'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../src/lib/supabase';

export default function TagReview() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [tagsInput, setTagsInput] = useState('');
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUntagged() {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, ingredients, tags')
        .or('tags.is.null,tags.eq.')
        .order('created_at', { ascending: true });
      if (!error && data) setRecipes(data);
      setLoading(false);
    }
    fetchUntagged();
  }, []);

  const currentRecipe = recipes[index];

  useEffect(() => {
    if (!currentRecipe) return;
    async function getSuggestion() {
      setLoadingSuggestion(true);
      setTagsInput('');
      try {
        const res = await fetch('/api/suggest-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: currentRecipe.title,
            ingredients: currentRecipe.ingredients,
          }),
        });
        const data = await res.json();
        setTagsInput(data.tags || '');
      } catch (err) {
        console.error(err);
      }
      setLoadingSuggestion(false);
    }
    getSuggestion();
  }, [currentRecipe]);

  async function saveAndNext() {
    if (currentRecipe) {
      await supabase.from('recipes').update({ tags: tagsInput }).eq('id', currentRecipe.id);
    }
    setIndex((i) => i + 1);
  }

  function skip() {
    setIndex((i) => i + 1);
  }

  if (loading) return <p style={{ padding: 24 }}>Loading untagged recipes...</p>;
  if (!currentRecipe) return <p style={{ padding: 24 }}>All recipes are tagged! 🎉</p>;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24, fontFamily: 'Georgia, serif' }}>
      <p style={{ fontFamily: 'system-ui, sans-serif', color: '#5a6b4a' }}>
        Recipe {index + 1} of {recipes.length}
      </p>
      <h2>{currentRecipe.title}</h2>
      <p style={{ whiteSpace: 'pre-line', color: '#555' }}>{currentRecipe.ingredients}</p>

      <label style={{ display: 'block', marginTop: 16, fontFamily: 'system-ui, sans-serif' }}>
        Tags (comma separated)
      </label>
      <input
        type="text"
        value={loadingSuggestion ? 'Thinking...' : tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        disabled={loadingSuggestion}
        style={{ width: '100%', padding: 10, marginTop: 8, border: '1px solid #e0dbd2', borderRadius: 8 }}
      />

      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button
          onClick={saveAndNext}
          disabled={loadingSuggestion}
          style={{ background: '#7c8c6e', color: 'white', padding: '10px 20px', borderRadius: 8, border: 'none' }}
        >
          Save & Next
        </button>
        <button
          onClick={skip}
          style={{ background: 'transparent', color: '#b85c3a', padding: '10px 20px', borderRadius: 8, border: '1px solid #b85c3a' }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}