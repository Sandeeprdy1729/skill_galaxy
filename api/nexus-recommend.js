/**
 * SkillForge Nexus — API Endpoint
 * Vercel Serverless Function: POST /api/nexus-recommend
 * 
 * Provides the Nexus graph-based skill composition engine via HTTP.
 */

import { createClient } from '@supabase/supabase-js';
import { CATEGORIES, SKILLS_DB } from '../../skills-data.js';

const SENSITIVITY_THRESHOLD = 0.65;
const SIMILARITY_WEIGHT = 0.4;
const TOKEN_WEIGHT = 0.3;
const SUCCESS_WEIGHT = 0.3;

function tokenize(text) {
  const words = (text || '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return freq;
}

function cosineSimilarity(a, b) {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of allKeys) {
    const va = a[k] || 0, vb = b[k] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  return (magA === 0 || magB === 0) ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function estimateTokens(skill) {
  const baseTokens = skill.md ? Math.round(skill.md.length / 3.5) : 200;
  const tagBonus = ((skill.tags || []).length * 5);
  const complexityBonus = { beginner: 0, intermediate: 50, advanced: 100, expert: 150 }[skill.difficulty] || 50;
  return baseTokens + tagBonus + complexityBonus;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, topK = 5, storeMetaSkill = false } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
      ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
      : null;

    let reviewCache = new Map();
    if (supabase) {
      const { data } = await supabase
        .from('skill_reviews')
        .select('skill_id, rating');
      
      if (data) {
        const ratings = new Map();
        for (const row of data) {
          if (!ratings.has(row.skill_id)) ratings.set(row.skill_id, []);
          ratings.get(row.skill_id).push(row.rating);
        }
        for (const [id, vals] of ratings) {
          reviewCache.set(id, vals.reduce((a, b) => a + b, 0) / vals.length);
        }
      }
    }

    const queryTokens = tokenize(query);
    const allSkills = Object.values(SKILLS_DB);
    
    const candidates = allSkills
      .map(skill => {
        const text = [skill.name, skill.desc, ...(skill.tags || [])].join(' ');
        const relevance = cosineSimilarity(queryTokens, tokenize(text));
        return { skill, relevance };
      })
      .filter(s => s.relevance > 0.1)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 50)
      .map(s => s.skill);

    if (!candidates.length) {
      return res.status(200).json({
        results: [],
        metaSkills: [],
        stats: { candidates: 0, tokenSavings: 0 },
      });
    }

    const graph = new Map();
    const embeddings = new Map();
    const tokenEstimates = new Map();

    for (const skill of candidates) {
      const text = [skill.name, skill.desc, ...(skill.tags || [])].join(' ');
      embeddings.set(skill.id, tokenize(text));
      tokenEstimates.set(skill.id, estimateTokens(skill));
    }

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i], b = candidates[j];
        const sim = cosineSimilarity(embeddings.get(a.id), embeddings.get(b.id));
        
        if (sim > SENSITIVITY_THRESHOLD) {
          if (!graph.has(a.id)) graph.set(a.id, []);
          if (!graph.has(b.id)) graph.set(b.id, []);
          graph.get(a.id).push({ target: b.id, sim });
          graph.get(b.id).push({ target: a.id, sim });
        }
      }
    }

    const computeNexusScore = (skill) => {
      const relevance = cosineSimilarity(embeddings.get(skill.id) || tokenize(skill.name), queryTokens);
      const tokens = tokenEstimates.get(skill.id) || 200;
      const normalizedTokenCost = Math.min(1, tokens / 500);
      const tokenScore = 1 - normalizedTokenCost;
      const successRate = (reviewCache.get(skill.id) || 3.5) / 5;
      
      return relevance * SIMILARITY_WEIGHT + tokenScore * TOKEN_WEIGHT + successRate * SUCCESS_WEIGHT;
    };

    const scored = candidates.map(skill => ({
      id: skill.id,
      name: skill.name,
      cat: skill.cat,
      desc: skill.desc,
      difficulty: skill.difficulty,
      tags: skill.tags || [],
      nexusScore: computeNexusScore(skill),
      tokenEstimate: tokenEstimates.get(skill.id) || 200,
      successRate: (reviewCache.get(skill.id) || 3.5) / 5,
      relevance: cosineSimilarity(embeddings.get(skill.id) || tokenize(skill.name), queryTokens),
    }));

    scored.sort((a, b) => b.nexusScore - a.nexusScore);
    const results = scored.slice(0, topK);

    const topCandidates = scored.slice(0, 8);
    const compositions = [];

    for (const start of topCandidates.slice(0, 3)) {
      const path = [start];
      let current = start;
      const visited = new Set([start.id]);

      for (let depth = 0; depth < 2; depth++) {
        const edges = graph.get(current.id) || [];
        let bestNext = null;
        let bestScore = -Infinity;

        for (const edge of edges) {
          if (visited.has(edge.target)) continue;
          const nextSkill = candidates.find(s => s.id === edge.target);
          if (!nextSkill) continue;

          const nextScore = computeNexusScore(nextSkill) + edge.sim * 0.3;
          if (nextScore > bestScore) {
            bestScore = nextScore;
            bestNext = nextSkill;
          }
        }

        if (bestNext) {
          path.push(bestNext);
          visited.add(bestNext.id);
          current = bestNext;
        }
      }

      const totalTokens = path.reduce((sum, s) => sum + (tokenEstimates.get(s.id) || 200), 0);
      const compositeScore = path.reduce((sum, s) => sum + computeNexusScore(s), 0) / path.length;
      const optimizedTokens = Math.round(totalTokens * 0.35);
      const tokenSavings = Math.round((1 - optimizedTokens / totalTokens) * 100);

      compositions.push({
        path,
        compositeScore,
        totalTokens,
        optimizedTokens,
        tokenSavings,
      });
    }

    compositions.sort((a, b) => b.compositeScore - a.compositeScore);
    const bestComposition = compositions[0];

    const metaSkills = [];
    if (bestComposition) {
      const allTags = [...new Set(bestComposition.path.flatMap(s => s.tags || []))];
      const querySlug = query.slice(0, 40).replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const metaId = `nexus-meta-${querySlug}-${Date.now()}`;

      const compositemd = [
        '---',
        `name: nexus-meta-${querySlug}`,
        `description: "Nexus-synthesized meta-skill for: ${query.slice(0, 200)}"`,
        `tags: ${allTags.slice(0, 10).join(', ')}`,
        `difficulty: intermediate`,
        `version: 1.0.0`,
        `nexus_score: ${bestComposition.compositeScore.toFixed(3)}`,
        `token_savings: ${bestComposition.tokenSavings}%`,
        `source_skill_ids: ${bestComposition.path.map(s => s.id).join(', ')}`,
        '---',
        '',
        `# Nexus Meta-Skill: ${querySlug}`,
        '',
        `> **SkillForge Nexus** — Synthesized from ${bestComposition.path.length} skills. ` +
        `Nexus Score: ${bestComposition.compositeScore.toFixed(3)} | Token Savings: ${bestComposition.tokenSavings}%`,
        '',
        '## Composed Skills',
        ...bestComposition.path.map((s, i) => [
          `### ${i + 1}. ${s.name} (\`${s.id}\`)`,
          `Category: ${s.cat} | Difficulty: ${s.difficulty}`,
          '',
          s.desc || '',
        ].join('\n')),
        '',
        '## Token Budget',
        '| Metric | Value |',
        '|--------|-------|',
        `| Naive concat | ~${bestComposition.totalTokens} tokens |`,
        `| Nexus optimized | ~${bestComposition.optimizedTokens} tokens |`,
        `| Savings | ${bestComposition.tokenSavings}% |`,
      ].join('\n');

      const metaSkill = {
        id: metaId,
        name: `nexus-meta-${querySlug}`,
        nexus_score: bestComposition.compositeScore,
        token_savings: bestComposition.tokenSavings,
        compositemd,
        path: bestComposition.path.map(s => ({
          id: s.id,
          name: s.name,
          cat: s.cat,
          desc: s.desc,
        })),
      };

      metaSkills.push(metaSkill);

      if (storeMetaSkill && supabase) {
        await supabase.from('meta_skills').upsert({
          id: metaSkill.id,
          source_skill_ids: bestComposition.path.map(s => s.id),
          nexus_score: metaSkill.nexus_score,
          token_savings: metaSkill.token_savings,
          md_content: metaSkill.compositemd,
          query_used: query,
        }, { onConflict: 'id' });
      }
    }

    const baselineTokens = results.reduce((sum, r) => sum + r.tokenEstimate, 0);
    const optimizedTokens = metaSkills.length 
      ? metaSkills[0].compositemd.length / 3.5 
      : baselineTokens;
    const totalSavings = Math.round((1 - optimizedTokens / Math.max(1, baselineTokens)) * 100);

    return res.status(200).json({
      query,
      recommendations: results,
      metaSkills,
      stats: {
        candidates: candidates.length,
        graphSize: graph.size,
        baselineTokens,
        optimizedTokens: Math.round(optimizedTokens),
        tokenSavings: totalSavings,
        avgNexusScore: results.length 
          ? results.reduce((s, r) => s + r.nexusScore, 0) / results.length 
          : 0,
      },
    });

  } catch (error) {
    console.error('Nexus error:', error);
    return res.status(500).json({ error: error.message });
  }
}
