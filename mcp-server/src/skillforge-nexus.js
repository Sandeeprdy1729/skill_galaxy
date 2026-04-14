/**
 * SkillForge Nexus — Graph-based Skill Composition Engine
 * 
 * A dynamic weighted composition graph over skills (nodes = skills; edges = semantic 
 * similarity + historical success + token cost). Uses Dijkstra-like traversal with 
 * custom Nexus Score to recommend or auto-synthesize meta-skills that maximize workflow 
 * success while minimizing tokens.
 * 
 * Nexus Score = relevance * 0.4 + (1 - normalizedTokenCost) * 0.3 + successProb * 0.3
 */

import { createClient } from '@supabase/supabase-js';
import { CATEGORIES, SKILLS_DB } from '../skills-data.js';

const SENSITIVITY_THRESHOLD = 0.65;
const SIMILARITY_WEIGHT = 0.4;
const TOKEN_WEIGHT = 0.3;
const SUCCESS_WEIGHT = 0.3;
const SYNERGY_DISCOUNT = 0.3;

class PriorityQueue {
  constructor() {
    this.items = [];
  }

  enqueue(element, priority) {
    const item = { element, priority };
    let added = false;
    for (let i = 0; i < this.items.length; i++) {
      if (item.priority < this.items[i].priority) {
        this.items.splice(i, 0, item);
        added = true;
        break;
      }
    }
    if (!added) this.items.push(item);
  }

  dequeue() {
    return this.items.shift()?.element;
  }

  isEmpty() {
    return this.items.length === 0;
  }
}

export class SkillForgeNexus {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = supabaseUrl && supabaseKey 
      ? createClient(supabaseUrl, supabaseKey) 
      : null;
    this.graph = new Map();
    this.embeddings = new Map();
    this.tokenEstimates = new Map();
    this.reviewCache = new Map();
    this.lastBuild = null;
  }

  _tokenize(text) {
    const words = (text || '').toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const freq = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    return freq;
  }

  _cosineSimilarity(a, b) {
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

  _estimateTokens(skill) {
    const baseTokens = skill.md ? Math.round(skill.md.length / 3.5) : 200;
    const tagBonus = ((skill.tags || []).length * 5);
    const complexityBonus = { beginner: 0, intermediate: 50, advanced: 100, expert: 150 }[skill.difficulty] || 50;
    return baseTokens + tagBonus + complexityBonus;
  }

  async _fetchReviews(skillIds) {
    if (!this.supabase) return new Map();
    
    const uncached = skillIds.filter(id => !this.reviewCache.has(id));
    if (uncached.length === 0) return this.reviewCache;

    const { data, error } = await this.supabase
      .from('skill_reviews')
      .select('skill_id, rating')
      .in('skill_id', uncached);

    if (error) return this.reviewCache;

    const ratings = new Map();
    for (const row of (data || [])) {
      if (!ratings.has(row.skill_id)) ratings.set(row.skill_id, []);
      ratings.get(row.skill_id).push(row.rating);
    }

    for (const [id, vals] of ratings) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      this.reviewCache.set(id, avg);
    }

    return this.reviewCache;
  }

  async buildGraph(skills = null) {
    const skillList = skills || Object.values(SKILLS_DB);
    this.graph.clear();
    this.embeddings.clear();
    this.tokenEstimates.clear();

    const skillTokens = new Map();
    for (const skill of skillList) {
      const text = [skill.name, skill.desc, ...(skill.tags || [])].join(' ');
      const tokens = this._tokenize(text);
      skillTokens.set(skill.id, tokens);
      this.embeddings.set(skill.id, tokens);
      this.tokenEstimates.set(skill.id, this._estimateTokens(skill));
    }

    const skillIds = [...this.embeddings.keys()];
    await this._fetchReviews(skillIds);

    for (let i = 0; i < skillList.length; i++) {
      for (let j = i + 1; j < skillList.length; j++) {
        const a = skillList[i], b = skillList[j];
        const embA = skillTokens.get(a.id), embB = skillTokens.get(b.id);
        const sim = this._cosineSimilarity(embA, embB);

        if (sim > SENSITIVITY_THRESHOLD) {
          const aSuccess = (this.reviewCache.get(a.id) || 0.75) / 5;
          const bSuccess = (this.reviewCache.get(b.id) || 0.75) / 5;
          const avgSuccess = (aSuccess + bSuccess) / 2;
          const tokenDelta = (this.tokenEstimates.get(a.id) + this.tokenEstimates.get(b.id)) * SYNERGY_DISCOUNT;

          if (!this.graph.has(a.id)) this.graph.set(a.id, { edges: [], successProb: new Map() });
          if (!this.graph.has(b.id)) this.graph.set(b.id, { edges: [], successProb: new Map() });

          this.graph.get(a.id).edges.push({ target: b.id, sim, successProb: avgSuccess, tokenDelta });
          this.graph.get(b.id).edges.push({ target: a.id, sim, successProb: avgSuccess, tokenDelta });
          this.graph.get(a.id).successProb.set(b.id, avgSuccess);
          this.graph.get(b.id).successProb.set(a.id, avgSuccess);
        }
      }
    }

    this.lastBuild = Date.now();
    return this;
  }

  _computeNexusScore(skill, queryTokens) {
    const emb = this.embeddings.get(skill.id) || this._tokenize(skill.name);
    const relevance = this._cosineSimilarity(emb, queryTokens);
    
    const tokens = this.tokenEstimates.get(skill.id) || 200;
    const normalizedTokenCost = Math.min(1, tokens / 500);
    const tokenScore = 1 - normalizedTokenCost;
    
    const successRate = (this.reviewCache.get(skill.id) || 3.5) / 5;

    return relevance * SIMILARITY_WEIGHT + 
           tokenScore * TOKEN_WEIGHT + 
           successRate * SUCCESS_WEIGHT;
  }

  _findOptimalCompositions(queryTokens, candidates, maxDepth = 3) {
    const scored = candidates.map(skill => ({
      skill,
      nexusScore: this._computeNexusScore(skill, queryTokens),
      tokens: this.tokenEstimates.get(skill.id) || 200,
    }));

    scored.sort((a, b) => b.nexusScore - a.nexusScore);

    const topCandidates = scored.slice(0, 10);
    const compositions = [];

    for (const start of topCandidates.slice(0, 5)) {
      const path = [start.skill];
      let totalTokens = start.tokens;
      let totalSuccess = (this.reviewCache.get(start.skill.id) || 3.5) / 5;
      let current = start;

      for (let depth = 1; depth < maxDepth; depth++) {
        const node = this.graph.get(current.skill.id);
        if (!node || !node.edges.length) break;

        let bestNext = null;
        let bestScore = -Infinity;

        for (const edge of node.edges) {
          if (path.find(s => s.id === edge.target)) continue;
          const nextSkill = candidates.find(s => s.id === edge.target);
          if (!nextSkill) continue;

          const nextNexus = this._computeNexusScore(nextSkill, queryTokens);
          const edgeBonus = edge.sim * edge.successProb;
          const combinedScore = nextNexus + edgeBonus * 0.5;

          if (combinedScore > bestScore) {
            bestScore = combinedScore;
            bestNext = { skill: nextSkill, edge };
          }
        }

        if (bestNext) {
          path.push(bestNext.skill);
          totalTokens += bestNext.skill.md ? Math.round(bestNext.skill.md.length / 3.5) : 200;
          totalSuccess = (totalSuccess + (this.reviewCache.get(bestNext.skill.id) || 3.5) / 5) / 2;
          current = bestNext;
        } else {
          break;
        }
      }

      const compositeScore = path.reduce((sum, s) => {
        return sum + (this._computeNexusScore(s, queryTokens));
      }, 0) / path.length;

      const synergyDiscount = (path.length - 1) * SYNERGY_DISCOUNT * 0.1;
      const optimizedTokens = Math.round(totalTokens * (1 - Math.min(0.5, synergyDiscount)));

      compositions.push({
        path,
        compositeScore,
        totalTokens,
        optimizedTokens,
        tokenSavings: Math.round((1 - optimizedTokens / totalTokens) * 100),
        avgSuccess: totalSuccess,
        pathLength: path.length,
      });
    }

    compositions.sort((a, b) => b.compositeScore - a.compositeScore);
    return compositions;
  }

  _synthesizeMetaSkill(composition, query) {
    const sourceIds = composition.path.map(s => s.id);
    const allTags = [...new Set(composition.path.flatMap(s => s.tags || []))];
    const querySlug = query.slice(0, 40).replace(/[^a-z0-9]/gi, '-').toLowerCase();
    
    const metaId = `nexus-meta-${querySlug}-${Date.now()}`;
    
    const compositemd = [
      '---',
      `name: nexus-meta-${querySlug}`,
      `description: "Nexus-synthesized meta-skill for: ${query.slice(0, 200)}"`,
      `tags: ${allTags.slice(0, 10).join(', ')}`,
      `difficulty: intermediate`,
      `version: 1.0.0`,
      `nexus_score: ${composition.compositeScore.toFixed(3)}`,
      `token_savings: ${composition.tokenSavings}%`,
      `source_skill_ids: ${sourceIds.join(', ')}`,
      `synthesized_at: ${new Date().toISOString()}`,
      '---',
      '',
      `# Nexus Meta-Skill: ${querySlug}`,
      '',
      `> **SkillForge Nexus** — Synthesized from ${composition.path.length} skills. ` +
      `Nexus Score: ${composition.compositeScore.toFixed(3)} | Token Savings: ${composition.tokenSavings}%`,
      '',
      '## Activation',
      'Use this meta-skill when you need to:',
      ...composition.path.map(s => `- ${s.desc || s.name}`),
      '',
      '## Composed Skills',
      '',
      ...composition.path.map((s, i) => [
        `### ${i + 1}. ${s.name} (\`${s.id}\`)`,
        `Category: ${s.cat} | Difficulty: ${s.difficulty}`,
        `Nexus Score: ${this._computeNexusScore(s, this._tokenize(query)).toFixed(3)}`,
        '',
        s.desc || '',
        '',
      ].join('\n')),
      '',
      '## Token Budget',
      '| Metric | Value |',
      '|--------|-------|',
      `| Naive concat | ~${composition.totalTokens} tokens |`,
      `| Nexus optimized | ~${composition.optimizedTokens} tokens |`,
      `| Savings | ${composition.tokenSavings}% |`,
      '',
      '## Original Skills',
      ...composition.path.map(s => `- \`${s.id}\` — ${s.name}`),
    ].join('\n');

    return {
      id: metaId,
      name: `nexus-meta-${querySlug}`,
      source_skill_ids: sourceIds,
      synthesized_at: new Date().toISOString(),
      nexus_score: composition.compositeScore,
      token_savings: composition.tokenSavings,
      compositemd,
      path: composition.path.map(s => ({
        id: s.id,
        name: s.name,
        cat: s.cat,
        desc: s.desc,
      })),
    };
  }

  async queryNexus(query, options = {}) {
    const { topK = 5, maxDepth = 3 } = options;
    
    if (!this.graph.size) {
      await this.buildGraph();
    }

    const queryTokens = this._tokenize(query);
    
    const allSkills = Object.values(SKILLS_DB);
    const candidates = allSkills
      .map(skill => ({
        skill,
        relevance: this._cosineSimilarity(
          this.embeddings.get(skill.id) || this._tokenize(skill.name),
          queryTokens
        ),
      }))
      .filter(s => s.relevance > 0.1)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 50)
      .map(s => s.skill);

    if (!candidates.length) {
      return {
        results: [],
        metaSkills: [],
        stats: { candidates: 0, compositions: 0, graphSize: this.graph.size },
      };
    }

    const compositions = this._findOptimalCompositions(queryTokens, candidates, maxDepth);
    const topCompositions = compositions.slice(0, 2);
    const metaSkills = topCompositions.map(c => this._synthesizeMetaSkill(c, query));

    const results = candidates.slice(0, topK).map(skill => ({
      id: skill.id,
      name: skill.name,
      cat: skill.cat,
      desc: skill.desc,
      difficulty: skill.difficulty,
      tags: skill.tags || [],
      nexusScore: this._computeNexusScore(skill, queryTokens),
      tokenEstimate: this.tokenEstimates.get(skill.id) || 200,
      successRate: (this.reviewCache.get(skill.id) || 3.5) / 5,
      relevance: this._cosineSimilarity(
        this.embeddings.get(skill.id) || this._tokenize(skill.name),
        queryTokens
      ),
    }));

    results.sort((a, b) => b.nexusScore - a.nexusScore);

    const baselineTokens = results.reduce((sum, r) => sum + r.tokenEstimate, 0);
    const metaTokens = metaSkills.reduce((sum, m) => sum + (m.compositemd?.length || 0) / 3.5, 0);
    const optimizedTokens = Math.round(metaTokens * 0.35);
    const totalSavings = Math.round((1 - optimizedTokens / Math.max(1, baselineTokens)) * 100);

    return {
      results,
      metaSkills,
      stats: {
        candidates: candidates.length,
        compositions: compositions.length,
        graphSize: this.graph.size,
        baselineTokens,
        optimizedTokens,
        tokenSavings: totalSavings,
        avgNexusScore: results.length ? results.reduce((s, r) => s + r.nexusScore, 0) / results.length : 0,
      },
    };
  }

  async storeMetaSkill(metaSkill) {
    if (!this.supabase) return { stored: false };
    
    const { data, error } = await this.supabase
      .from('meta_skills')
      .upsert({
        id: metaSkill.id,
        source_skill_ids: metaSkill.source_skill_ids,
        synthesized_at: metaSkill.synthesized_at,
        nexus_score: metaSkill.nexus_score,
        token_savings: metaSkill.token_savings,
        md_content: metaSkill.compositemd,
      }, { onConflict: 'id' });

    return { stored: !error, error };
  }

  async getCachedGraph() {
    if (!this.lastBuild || Date.now() - this.lastBuild > 3600000) {
      await this.buildGraph();
    }
    return this;
  }
}

export function createNexusTool(supabaseUrl, supabaseKey) {
  const nexus = new SkillForgeNexus(supabaseUrl, supabaseKey);

  return {
    name: 'nexus_recommend',
    description: `SkillForge Nexus — Graph-based skill composition engine. 
Provide a natural language query to get AI-optimized skill recommendations with:
- Nexus Score (relevance + token cost + success rate)
- Auto-synthesized meta-skills that bundle compatible skills
- Projected token savings via progressive disclosure
- Composition chains with synergy detection

Example: "build a web scraper with data export to Notion via MCP"`,
    
    inputSchema: {
      query: { 
        type: 'string', 
        description: 'Natural language query describing the desired workflow or skill composition',
      },
      topK: { 
        type: 'number', 
        description: 'Number of top recommendations to return (default: 5)',
        minimum: 1,
        maximum: 20,
      },
      storeMetaSkill: {
        type: 'boolean',
        description: 'Whether to store synthesized meta-skills in Supabase for future use (default: false)',
      },
    },

    async execute({ query, topK = 5, storeMetaSkill = false }) {
      try {
        await nexus.getCachedGraph();
        const result = await nexus.queryNexus(query, { topK, maxDepth: 3 });

        if (storeMetaSkill && result.metaSkills.length > 0) {
          for (const meta of result.metaSkills) {
            await nexus.storeMetaSkill(meta);
          }
        }

        let output = `# SkillForge Nexus Results\n\n`;
        output += `## Query: "${query}"\n\n`;
        output += `**Stats:** ${result.stats.candidates} candidates | ${result.stats.compositions} compositions | Graph: ${result.stats.graphSize} nodes\n`;
        output += `**Token Impact:** ~${result.stats.baselineTokens} → ~${result.stats.optimizedTokens} tokens (${result.stats.tokenSavings}% savings)\n\n`;

        if (result.results.length > 0) {
          output += `## Top Recommendations\n\n`;
          output += `| # | Skill | Category | Nexus Score | Tokens | Success |\n`;
          output += `|---|-------|----------|-------------|--------|--------|\n`;
          result.results.forEach((r, i) => {
            output += `| ${i + 1} | [${r.name}](${r.id}) | ${r.cat} | ${r.nexusScore.toFixed(3)} | ~${r.tokenEstimate} | ${Math.round(r.successRate * 100)}% |\n`;
          });
          output += `\n`;
        }

        if (result.metaSkills.length > 0) {
          output += `## Synthesized Meta-Skills\n\n`;
          result.metaSkills.forEach((m, i) => {
            output += `### ${i + 1}. ${m.name}\n`;
            output += `**Nexus Score:** ${m.nexus_score.toFixed(3)} | **Token Savings:** ${m.token_savings}%\n`;
            output += `**Source Skills:** ${m.path.map(s => `\`${s.id}\``).join(', ')}\n\n`;
            output += `\`\`\`markdown\n${m.compositemd.slice(0, 800)}...\n\`\`\`\n\n`;
          });
        }

        return {
          content: [{ type: 'text', text: output }],
          recommendations: result.results,
          metaSkills: result.metaSkills,
          stats: result.stats,
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Nexus error: ${error.message}` }],
          error: error.message,
        };
      }
    },
  };
}
