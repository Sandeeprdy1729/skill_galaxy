/**
 * SkillGalaxy — SkillForge Recommender API
 * Vercel Serverless Function: POST /api/skillforge-recommend
 *
 * Request body:
 *   { query: string, skills?: [{id,name,desc,cat,tags}][], traces?: string[][],
 *     maxResults?: number, synthesise?: boolean }
 *
 * Response:
 *   { recommendations: [{id,name,category,similarity,tokenCost,desc,tags}][],
 *     totalTokens: number, effectiveTokens: number, metaSavings: number,
 *     naiveTotalTokens: number, savingsPercent: number,
 *     metaSkill?: string,       // markdown (only when synthesise=true)
 *     patterns?: {pattern,frequency}[],
 *     configured: boolean }
 *
 * Pure algorithmic — no external AI API key required.
 */

import {
  buildCoUsageGraph,
  detectPatterns,
  recommendSkills,
  naiveRecommend,
  synthesiseMetaSkill,
} from '../lib/skillforge-engine.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const {
    query = '',
    skills = [],
    traces = [],
    maxResults = 6,
    synthesise = false,
  } = req.body || {};

  if (!query.trim()) {
    return res.status(400).json({ error: 'Missing query' });
  }

  if (!Array.isArray(skills) || skills.length === 0) {
    return res.status(400).json({ error: 'Missing skills array' });
  }

  try {
    // Limit input sizes for safety
    const safeSkills = skills.slice(0, 500).map((s) => ({
      id:          String(s.id || '').slice(0, 120),
      name:        String(s.name || '').slice(0, 120),
      desc:        String(s.desc || s.description || '').slice(0, 300),
      cat:         String(s.cat || s.category || 'ai').slice(0, 30),
      tags:        Array.isArray(s.tags) ? s.tags.slice(0, 10).map((t) => String(t).slice(0, 40)) : [],
      difficulty:  String(s.difficulty || 'intermediate'),
      trigger:     String(s.trigger || s.trigger_text || '').slice(0, 200),
    }));

    const safeTraces = (Array.isArray(traces) ? traces : [])
      .slice(0, 1000)
      .map((t) => (Array.isArray(t) ? t.slice(0, 20).map((id) => String(id).slice(0, 120)) : []));

    // Build co-usage graph
    const coUsageGraph = buildCoUsageGraph(safeTraces);

    // Detect patterns
    const patterns = safeTraces.length > 0
      ? detectPatterns(safeTraces, 2, 4).slice(0, 20)
      : [];

    // SkillForge recommendation
    const forgeResult = recommendSkills({
      query:        query.slice(0, 500),
      skills:       safeSkills,
      coUsageGraph,
      maxResults:   Math.min(maxResults, 12),
      targetCoverage: 0.8,
    });

    // Naive baseline for comparison
    const naiveResult = naiveRecommend({
      query: query.slice(0, 500),
      skills: safeSkills,
      topK: Math.min(maxResults, 12),
    });

    const savingsPercent = naiveResult.totalTokens > 0
      ? Math.round(((naiveResult.totalTokens - forgeResult.effectiveTokens) / naiveResult.totalTokens) * 100)
      : 0;

    // Optional meta-skill synthesis
    let metaSkill = null;
    if (synthesise && forgeResult.selected.length >= 2) {
      // Map back to full skill objects for synthesis
      const selectedFull = forgeResult.selected.map((sel) => {
        const full = safeSkills.find((s) => s.id === sel.id);
        return full || sel;
      });

      metaSkill = synthesiseMetaSkill({
        name: `${query.slice(0, 60)} Meta-Skill`,
        description: `Optimised skill bundle for: ${query.slice(0, 200)}`,
        skills: selectedFull,
      });
    }

    return res.status(200).json({
      configured:      true,
      recommendations: forgeResult.selected,
      totalTokens:     forgeResult.totalTokens,
      effectiveTokens: forgeResult.effectiveTokens,
      metaSavings:     forgeResult.metaSavings,
      naiveTotalTokens: naiveResult.totalTokens,
      savingsPercent:  Math.max(0, savingsPercent),
      patterns:        patterns.length > 0 ? patterns : undefined,
      metaSkill:       metaSkill || undefined,
    });
  } catch (err) {
    console.error('skillforge-recommend error:', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}
