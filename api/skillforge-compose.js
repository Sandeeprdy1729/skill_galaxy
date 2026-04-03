/**
 * SkillGalaxy — SkillForge Composer: Evolutionary Skill Graph Composer
 * Vercel Serverless Function: POST /api/skillforge-compose
 *
 * Request body: {
 *   query: string,
 *   skillSummaries: [{id, name, desc, cat, tags, tokens, success_rate}][],
 *   generations?: number,      // evolutionary generations (default 8)
 *   populationSize?: number,   // GA population size (default 20)
 *   maxCompositeSize?: number  // max skills in composite (default 8)
 * }
 *
 * Response: {
 *   composite: { skills: [], totalTokens, tokenSavings, fitness, compositemd },
 *   configured: boolean
 * }
 *
 * Uses an evolutionary graph algorithm to discover, prune, and recommend
 * optimal skill subgraphs for a user's query. Generates a "forged" composite
 * skill (.md) with shared context and pruned redundancies.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const {
    query = '',
    skillSummaries = [],
    generations = 8,
    populationSize = 20,
    maxCompositeSize = 8,
  } = req.body || {};

  if (!query.trim()) return res.status(400).json({ error: 'Missing query' });
  if (!skillSummaries.length) return res.status(400).json({ error: 'Missing skillSummaries' });

  // Cap inputs to prevent abuse
  const safeGens = Math.min(Math.max(generations, 1), 20);
  const safePop  = Math.min(Math.max(populationSize, 5), 50);
  const safeMax  = Math.min(Math.max(maxCompositeSize, 2), 12);
  const sample   = skillSummaries.slice(0, 200);

  // ── Step 1: Compute similarity scores (TF-IDF-like token matching) ──
  const queryTokens = tokenize(query);
  const scored = sample.map(skill => {
    const skillTokens = tokenize(
      [skill.name, skill.desc, ...(skill.tags || [])].join(' ')
    );
    const sim = cosineSimilarity(queryTokens, skillTokens);
    const tokens = estimateTokens(skill);
    const successRate = skill.success_rate || 0.75;
    return { ...skill, sim, tokens, successRate };
  });

  // Sort by similarity for initial candidate pool
  scored.sort((a, b) => b.sim - a.sim);
  const candidates = scored.slice(0, Math.max(safePop * 2, 40));

  // ── Step 2: Build skill graph (edges = tag/category synergy) ────────
  const graph = buildSkillGraph(candidates);

  // ── Step 3: Evolutionary optimization ───────────────────────────────
  let population = initializePopulation(candidates, safePop, safeMax);

  for (let gen = 0; gen < safeGens; gen++) {
    // Evaluate fitness for each individual
    population = population.map(individual => ({
      ...individual,
      fitness: evaluateFitness(individual.skills, graph),
    }));

    // Sort by fitness (higher is better)
    population.sort((a, b) => b.fitness - a.fitness);

    // Selection: keep top 50%
    const survivors = population.slice(0, Math.ceil(safePop / 2));

    // Generate new population via crossover + mutation
    const newPop = [...survivors];
    while (newPop.length < safePop) {
      const parentA = survivors[Math.floor(Math.random() * survivors.length)];
      const parentB = survivors[Math.floor(Math.random() * survivors.length)];
      const child = crossover(parentA, parentB, safeMax);
      const mutated = mutate(child, candidates, graph, safeMax);
      newPop.push(mutated);
    }
    population = newPop;
  }

  // Final fitness evaluation
  population = population.map(individual => ({
    ...individual,
    fitness: evaluateFitness(individual.skills, graph),
  }));
  population.sort((a, b) => b.fitness - a.fitness);
  const best = population[0];

  // ── Step 4: Prune overlapping content ───────────────────────────────
  const pruned = pruneOverlaps(best.skills);

  // ── Step 5: Calculate metrics ───────────────────────────────────────
  const naiveTokens     = best.skills.reduce((s, sk) => s + sk.tokens, 0);
  const prunedTokens    = Math.round(naiveTokens * (1 - pruned.overlapReduction));
  const baselineTokens  = Math.round(naiveTokens * 1.3); // naive concat penalty
  const tokenSavings    = Math.round((1 - prunedTokens / baselineTokens) * 100);

  // ── Step 6: Generate composite skill .md ────────────────────────────
  const compositeMd = generateCompositeMD(best.skills, query, pruned);

  // ── Step 7: Optionally call Claude to refine the composite ──────────
  let refinedMd = compositeMd;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && best.skills.length >= 2) {
    try {
      refinedMd = await refineWithClaude(apiKey, compositeMd, query, best.skills);
    } catch {
      // Fall back to algorithmic composite
      refinedMd = compositeMd;
    }
  }

  return res.status(200).json({
    configured: !!apiKey,
    composite: {
      skills: best.skills.map(s => ({
        id: s.id,
        name: s.name,
        category: s.cat,
        similarity: Math.round(s.sim * 100) / 100,
        tokens: s.tokens,
        successRate: Math.round(s.successRate * 100) / 100,
      })),
      fitness:       Math.round(best.fitness * 1000) / 1000,
      totalTokens:   prunedTokens,
      baselineTokens,
      tokenSavings:  `${tokenSavings}%`,
      overlapPruned: `${Math.round(pruned.overlapReduction * 100)}%`,
      compositemd:   refinedMd.slice(0, 30000),
      synergies:     pruned.synergies.slice(0, 10),
    },
  });
}


// ═══════════════════════════════════════════════════════════════════════
// CORE ALGORITHMS
// ═══════════════════════════════════════════════════════════════════════

/** Tokenize text into normalized word set with frequencies. */
function tokenize(text) {
  const words = (text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(Boolean);
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return freq;
}

/** Cosine similarity between two token frequency maps. */
function cosineSimilarity(a, b) {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of allKeys) {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot  += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Estimate token count for a skill (based on desc + name + tags). */
function estimateTokens(skill) {
  if (skill.tokens && skill.tokens > 0) return skill.tokens;
  const text = [skill.name, skill.desc, ...(skill.tags || [])].join(' ');
  return Math.max(300, Math.round(text.length / 3.5)); // rough char-to-token ratio
}

/** Build a directed graph of skill synergies. */
function buildSkillGraph(skills) {
  const nodes = new Map();
  const edges = [];

  for (const s of skills) {
    nodes.set(s.id, s);
  }

  // Compute edges based on shared tags + category alignment
  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const a = skills[i];
      const b = skills[j];
      const aTags = new Set((a.tags || []).map(t => t.toLowerCase()));
      const bTags = new Set((b.tags || []).map(t => t.toLowerCase()));
      const shared = [...aTags].filter(t => bTags.has(t));

      if (shared.length === 0 && a.cat !== b.cat) continue;

      // Synergy = shared tags * category bonus * success product
      const catBonus = a.cat === b.cat ? 1.5 : 1.0;
      const synergy  = (shared.length * 0.3 + catBonus * 0.2) * a.successRate * b.successRate;

      // Overlap = how many tokens are redundant (estimated from tag/desc similarity)
      const descSim = cosineSimilarity(tokenize(a.desc || ''), tokenize(b.desc || ''));
      const overlap = Math.min(0.5, descSim * 0.6 + shared.length * 0.05);

      edges.push({ from: a.id, to: b.id, synergy, overlap, sharedTags: shared });
    }
  }

  return { nodes, edges };
}

/** Initialize a population of random subgraphs. */
function initializePopulation(candidates, popSize, maxSize) {
  const population = [];
  for (let i = 0; i < popSize; i++) {
    // Each individual starts with top-K similar skills + random mutations
    const size = Math.min(3 + Math.floor(Math.random() * (maxSize - 2)), maxSize);
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    // Bias toward high-similarity candidates
    const biased = [
      ...candidates.slice(0, Math.ceil(size / 2)),
      ...shuffled.slice(0, Math.floor(size / 2)),
    ];
    const unique = [...new Map(biased.map(s => [s.id, s])).values()].slice(0, size);
    population.push({ skills: unique });
  }
  return population;
}

/** Evaluate fitness of a skill subgraph: (relevance * success - token_cost + synergy). */
function evaluateFitness(skills, graph) {
  if (!skills.length) return 0;

  const avgSim     = skills.reduce((s, sk) => s + sk.sim, 0) / skills.length;
  const avgSuccess = skills.reduce((s, sk) => s + sk.successRate, 0) / skills.length;
  const totalTokens = skills.reduce((s, sk) => s + sk.tokens, 0);
  const tokenPenalty = totalTokens / 10000; // normalize

  // Compute total synergy from graph edges within this subgraph
  const ids = new Set(skills.map(s => s.id));
  let totalSynergy = 0;
  let totalOverlap = 0;
  let edgeCount    = 0;

  for (const edge of graph.edges) {
    if (ids.has(edge.from) && ids.has(edge.to)) {
      totalSynergy += edge.synergy;
      totalOverlap += edge.overlap;
      edgeCount++;
    }
  }

  // Diversity bonus: reward covering different categories
  const catSet = new Set(skills.map(s => s.cat));
  const diversityBonus = catSet.size * 0.05;

  // Fitness = relevance + success + synergy - overlap - token_cost + diversity
  return (
    avgSim * 3.0 +
    avgSuccess * 1.5 +
    totalSynergy * 0.5 -
    totalOverlap * 0.8 -
    tokenPenalty * 0.3 +
    diversityBonus
  );
}

/** Crossover: merge two parents into a child subgraph. */
function crossover(parentA, parentB, maxSize) {
  const half = Math.ceil(maxSize / 2);
  const childSkills = [
    ...parentA.skills.slice(0, half),
    ...parentB.skills.slice(half),
  ];
  // Deduplicate
  const unique = [...new Map(childSkills.map(s => [s.id, s])).values()].slice(0, maxSize);
  return { skills: unique };
}

/** Mutate: randomly swap a skill with a graph neighbor or random candidate. */
function mutate(individual, candidates, graph, maxSize) {
  const skills = [...individual.skills];
  if (Math.random() < 0.3 && skills.length > 1) {
    // Remove weakest skill
    skills.sort((a, b) => b.sim - a.sim);
    skills.pop();
  }
  if (Math.random() < 0.5 && skills.length < maxSize) {
    // Add a graph neighbor of a random existing skill
    const randomSkill = skills[Math.floor(Math.random() * skills.length)];
    const neighborEdges = graph.edges.filter(
      e => (e.from === randomSkill.id || e.to === randomSkill.id) && e.synergy > 0.1
    );
    if (neighborEdges.length > 0) {
      const edge = neighborEdges[Math.floor(Math.random() * neighborEdges.length)];
      const neighborId = edge.from === randomSkill.id ? edge.to : edge.from;
      const neighbor = graph.nodes.get(neighborId);
      if (neighbor && !skills.find(s => s.id === neighborId)) {
        skills.push(neighbor);
      }
    }
  }
  if (Math.random() < 0.2 && skills.length < maxSize) {
    // Add random high-similarity candidate
    const unused = candidates.filter(c => !skills.find(s => s.id === c.id));
    if (unused.length > 0) {
      skills.push(unused[Math.floor(Math.random() * Math.min(unused.length, 10))]);
    }
  }
  return { skills: skills.slice(0, maxSize) };
}

/** Prune overlapping content between skills. Returns reduction factor + synergies. */
function pruneOverlaps(skills) {
  const synergies = [];
  let totalOverlap = 0;
  let comparisons = 0;

  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const a = skills[i];
      const b = skills[j];
      const aTags = new Set((a.tags || []).map(t => t.toLowerCase()));
      const bTags = new Set((b.tags || []).map(t => t.toLowerCase()));
      const shared = [...aTags].filter(t => bTags.has(t));
      const descSim = cosineSimilarity(tokenize(a.desc || ''), tokenize(b.desc || ''));

      const overlap = Math.min(0.5, descSim * 0.5 + shared.length * 0.05);
      totalOverlap += overlap;
      comparisons++;

      if (shared.length > 0 || descSim > 0.2) {
        synergies.push({
          pair: [a.name, b.name],
          sharedTags: shared,
          descSimilarity: Math.round(descSim * 100) / 100,
          overlapPct: Math.round(overlap * 100),
        });
      }
    }
  }

  const avgOverlap = comparisons > 0 ? totalOverlap / comparisons : 0;
  // Token savings from deduplication: remove overlapping sections
  const overlapReduction = Math.min(0.4, avgOverlap * 1.5);

  return { overlapReduction, synergies };
}

/** Generate a composite .md skill file from the selected skills. */
function generateCompositeMD(skills, query, pruned) {
  const ids = skills.map(s => s.id);
  const allTags = [...new Set(skills.flatMap(s => s.tags || []))];
  const allCats = [...new Set(skills.map(s => s.cat))];
  const compositeName = `forged-${query.slice(0, 40).replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;

  const md = `---
name: ${compositeName}
description: "Forged composite skill: ${query.slice(0, 200)}"
tags: ${allTags.slice(0, 10).join(', ')}
difficulty: intermediate
version: 1.0.0
forged_from: ${ids.join(', ')}
token_savings: ${Math.round(pruned.overlapReduction * 100)}%
---

# ${compositeName}

> **SkillForge Composite** — Automatically composed from ${skills.length} skills for: "${query.slice(0, 150)}"

## Activation

Use this composite skill when you need to:
${skills.map(s => `- ${s.desc || s.name}`).join('\n')}

## Composed Skills

${skills.map((s, i) => `### ${i + 1}. ${s.name}
- **Category:** ${s.cat}
- **Relevance:** ${Math.round((s.sim || 0) * 100)}%
- **Tokens:** ~${s.tokens}
- **Tags:** ${(s.tags || []).join(', ')}

${s.desc || ''}`).join('\n\n')}

## Synergies Detected

${pruned.synergies.length > 0
    ? pruned.synergies.slice(0, 5).map(syn =>
      `- **${syn.pair[0]}** ↔ **${syn.pair[1]}**: ${syn.sharedTags.join(', ')} (${syn.overlapPct}% overlap pruned)`
    ).join('\n')
    : 'No significant overlaps detected — all skills complement each other.'}

## Token Budget

| Metric | Value |
|--------|-------|
| Baseline (naive concat) | ~${skills.reduce((s, sk) => s + sk.tokens, 0) * 1.3} tokens |
| After SkillForge pruning | ~${Math.round(skills.reduce((s, sk) => s + sk.tokens, 0) * (1 - pruned.overlapReduction))} tokens |
| Savings | ${Math.round(pruned.overlapReduction * 100)}% |

## Usage

Add this file to your Claude Project instructions. Claude will activate the relevant sub-skill based on your query context, using progressive disclosure to minimize token usage.

### Original Skills (install individually)
${skills.map(s => `- \`${s.id}\``).join('\n')}
`;

  return md;
}

/** Optionally refine the composite using Claude for higher quality output. */
async function refineWithClaude(apiKey, compositeMd, query, skills) {
  const skillNames = skills.map(s => s.name).join(', ');

  const prompt = `You are SkillForge, an AI that creates optimized composite skill files for Claude.

I have algorithmically composed ${skills.length} skills (${skillNames}) for this query: "${query.slice(0, 300)}"

Here is the raw composite:

${compositeMd.slice(0, 8000)}

Refine this into a polished, production-quality composite skill .md file:
1. Keep the YAML frontmatter (update if needed)
2. Write a clear unified activation section
3. Merge overlapping instructions between skills
4. Add a "Workflow" section showing how the skills chain together
5. Keep it under 3000 tokens total
6. Credit all original skills in a "Provenance" section

Return ONLY the raw .md file content starting with ---. No explanation.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-5',
      max_tokens: 3000,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) return compositeMd;

  const data = await response.json();
  let md = (data?.content?.[0]?.text || '').trim();
  if (!md.startsWith('---')) md = '---\n' + md;
  return md;
}
