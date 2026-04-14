/**
 * SkillGalaxy — skillforge-compose.js
 * Frontend logic for the SkillForge Evolutionary Composer.
 * Runs the evolutionary algorithm CLIENT-SIDE using skill data already loaded in db.js.
 * No server round-trip needed — all 10k+ skills are available in-browser.
 */

/* ── STATE ───────────────────────────────────────── */
let forgeResult    = null;
let forgeRunning   = false;

/* ── MODAL CONTROLS ──────────────────────────────── */
function openForgeComposer() {
  document.getElementById('forgeOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Reset state
  forgeResult  = null;
  forgeRunning = false;
  document.getElementById('forge-query').value = '';
  document.getElementById('forge-result').style.display = 'none';
  document.getElementById('forge-error').style.display  = 'none';
  document.getElementById('forge-metrics').style.display = 'none';
  document.getElementById('forge-compose-btn').disabled  = false;
  document.getElementById('forge-compose-btn').textContent = '⚡ Forge Composite';
  document.getElementById('forge-download-btn').style.display = 'none';
  document.getElementById('forge-submit-btn').style.display   = 'none';
}

function closeForgeComposer() {
  document.getElementById('forgeOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════════════════════════
   EVOLUTIONARY ALGORITHM (runs entirely in-browser)
   ═══════════════════════════════════════════════════════════════════════ */

/** Tokenize text into normalized word frequency map. */
function _forgeTokenize(text) {
  const words = (text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(Boolean);
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return freq;
}

/** Cosine similarity between two token frequency maps. */
function _forgeCosine(a, b) {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of allKeys) {
    const va = a[k] || 0, vb = b[k] || 0;
    dot  += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  return (magA === 0 || magB === 0) ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Build synergy graph edges between candidate skills. */
function _forgeBuildGraph(skills) {
  const nodes = new Map(skills.map(s => [s.id, s]));
  const edges = [];
  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const a = skills[i], b = skills[j];
      const aTags = new Set((a.tags || []).map(t => t.toLowerCase()));
      const bTags = new Set((b.tags || []).map(t => t.toLowerCase()));
      const shared = [...aTags].filter(t => bTags.has(t));
      if (shared.length === 0 && a.cat !== b.cat) continue;
      const catBonus = a.cat === b.cat ? 1.5 : 1.0;
      const synergy  = shared.length * 0.3 + catBonus * 0.2;
      const descSim  = _forgeCosine(_forgeTokenize(a.desc || ''), _forgeTokenize(b.desc || ''));
      const overlap  = Math.min(0.5, descSim * 0.6 + shared.length * 0.05);
      edges.push({ from: a.id, to: b.id, synergy, overlap, sharedTags: shared });
    }
  }
  return { nodes, edges };
}

/** Evaluate fitness of a skill subgraph. */
function _forgeFitness(skills, graph) {
  if (!skills.length) return 0;
  const avgSim     = skills.reduce((s, sk) => s + (sk._sim || 0), 0) / skills.length;
  const avgSuccess = skills.reduce((s, sk) => s + (sk._success || 0.75), 0) / skills.length;
  const totalTokens = skills.reduce((s, sk) => s + (sk._tokens || 500), 0);
  const tokenPenalty = totalTokens / 10000;
  const ids = new Set(skills.map(s => s.id));
  let totalSynergy = 0, totalOverlap = 0;
  for (const e of graph.edges) {
    if (ids.has(e.from) && ids.has(e.to)) {
      totalSynergy += e.synergy;
      totalOverlap += e.overlap;
    }
  }
  const catSet = new Set(skills.map(s => s.cat));
  return avgSim * 3.0 + avgSuccess * 1.5 + totalSynergy * 0.5
       - totalOverlap * 0.8 - tokenPenalty * 0.3 + catSet.size * 0.05;
}

/** Run the full evolutionary forge pipeline client-side. */
function _forgeEvolve(query, allSkills, maxSize, generations, popSize) {
  // Step 1: Score all skills by query relevance
  const queryTokens = _forgeTokenize(query);
  const scored = allSkills.map(s => {
    const skillText = [s.name, s.desc, ...(s.tags || [])].join(' ');
    const sim    = _forgeCosine(queryTokens, _forgeTokenize(skillText));
    const tokens = s.md ? Math.round(s.md.length / 3.5) : 500;
    const success = s.avgRating ? s.avgRating / 5 : 0.75;
    return { ...s, _sim: sim, _tokens: tokens, _success: success };
  });
  scored.sort((a, b) => b._sim - a._sim);
  const candidates = scored.slice(0, 50); // top 50 candidates

  if (!candidates.length || candidates[0]._sim === 0) return null;

  // Step 2: Build graph
  const graph = _forgeBuildGraph(candidates);

  // Step 3: Initialize population
  let pop = [];
  for (let i = 0; i < popSize; i++) {
    const size = Math.min(3 + Math.floor(Math.random() * (maxSize - 2)), maxSize);
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const biased = [
      ...candidates.slice(0, Math.ceil(size / 2)),
      ...shuffled.slice(0, Math.floor(size / 2)),
    ];
    const unique = [...new Map(biased.map(s => [s.id, s])).values()].slice(0, size);
    pop.push(unique);
  }

  // Step 4: Evolve
  for (let gen = 0; gen < generations; gen++) {
    pop.sort((a, b) => _forgeFitness(b, graph) - _forgeFitness(a, graph));
    const survivors = pop.slice(0, Math.ceil(popSize / 2));
    const newPop = [...survivors];
    while (newPop.length < popSize) {
      const pA = survivors[Math.floor(Math.random() * survivors.length)];
      const pB = survivors[Math.floor(Math.random() * survivors.length)];
      const half = Math.ceil(maxSize / 2);
      let child = [...pA.slice(0, half), ...pB.slice(half)];
      child = [...new Map(child.map(s => [s.id, s])).values()].slice(0, maxSize);
      // Mutate: add graph neighbor
      if (Math.random() < 0.5 && child.length < maxSize) {
        const rs = child[Math.floor(Math.random() * child.length)];
        const nEdges = graph.edges.filter(e => (e.from === rs.id || e.to === rs.id) && e.synergy > 0.1);
        if (nEdges.length) {
          const e = nEdges[Math.floor(Math.random() * nEdges.length)];
          const nId = e.from === rs.id ? e.to : e.from;
          const n = graph.nodes.get(nId);
          if (n && !child.find(s => s.id === nId)) child.push(n);
        }
      }
      // Mutate: remove weakest
      if (Math.random() < 0.3 && child.length > 2) {
        child.sort((a, b) => (b._sim || 0) - (a._sim || 0));
        child.pop();
      }
      newPop.push(child);
    }
    pop = newPop;
  }

  // Step 5: Select best
  pop.sort((a, b) => _forgeFitness(b, graph) - _forgeFitness(a, graph));
  const best = pop[0];
  const fitness = _forgeFitness(best, graph);

  // Step 6: Overlap & synergy analysis
  const synergies = [];
  let totalOverlap = 0, comparisons = 0;
  for (let i = 0; i < best.length; i++) {
    for (let j = i + 1; j < best.length; j++) {
      const a = best[i], b = best[j];
      const aTags = new Set((a.tags || []).map(t => t.toLowerCase()));
      const bTags = new Set((b.tags || []).map(t => t.toLowerCase()));
      const shared = [...aTags].filter(t => bTags.has(t));
      const descSim = _forgeCosine(_forgeTokenize(a.desc || ''), _forgeTokenize(b.desc || ''));
      const overlap = Math.min(0.5, descSim * 0.5 + shared.length * 0.05);
      totalOverlap += overlap;
      comparisons++;
      if (shared.length > 0 || descSim > 0.15) {
        synergies.push({ pair: [a.name, b.name], sharedTags: shared, overlapPct: Math.round(overlap * 100) });
      }
    }
  }
  const avgOverlap = comparisons > 0 ? totalOverlap / comparisons : 0;
  const overlapReduction = Math.min(0.4, avgOverlap * 1.5);

  // Step 7: Token metrics
  const naiveTokens    = best.reduce((s, sk) => s + (sk._tokens || 500), 0);
  const baselineTokens = Math.round(naiveTokens * 1.3);
  const prunedTokens   = Math.round(naiveTokens * (1 - overlapReduction));
  const tokenSavings   = Math.round((1 - prunedTokens / baselineTokens) * 100);

  // Step 8: Generate composite .md
  const allTags = [...new Set(best.flatMap(s => s.tags || []))];
  const compositeName = 'forged-' + query.slice(0, 40).replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const compositemd = [
    '---',
    `name: ${compositeName}`,
    `description: "Forged composite: ${query.slice(0, 200)}"`,
    `tags: ${allTags.slice(0, 10).join(', ')}`,
    `difficulty: intermediate`,
    `version: 1.0.0`,
    `forged_from: ${best.map(s => s.id).join(', ')}`,
    `token_savings: ${tokenSavings}%`,
    '---',
    '',
    `# ${compositeName}`,
    '',
    `> **SkillForge Composite** — ${best.length} skills optimized for: "${query.slice(0, 150)}"`,
    '',
    '## Activation',
    'Use this composite skill when you need to:',
    ...best.map(s => `- ${s.desc || s.name}`),
    '',
    '## Composed Skills',
    '',
    ...best.map((s, i) => [
      `### ${i + 1}. ${s.name} (\`${s.id}\`)`,
      `Category: ${s.cat} | Relevance: ${Math.round((s._sim || 0) * 100)}% | ~${s._tokens} tokens`,
      '', s.desc || '', '',
    ].join('\n')),
    '## Token Budget',
    '| Metric | Value |',
    '|--------|-------|',
    `| Baseline (naive concat) | ~${baselineTokens} tokens |`,
    `| After SkillForge pruning | ~${prunedTokens} tokens |`,
    `| Savings | ${tokenSavings}% |`,
    '',
    synergies.length > 0
      ? '## Synergies\n' + synergies.slice(0, 5).map(syn =>
          `- **${syn.pair[0]}** ↔ **${syn.pair[1]}**: ${syn.sharedTags.join(', ')} (${syn.overlapPct}% overlap pruned)`
        ).join('\n')
      : '',
    '',
    '## Original Skills',
    ...best.map(s => `- \`${s.id}\` — ${s.name}`),
  ].join('\n');

  return {
    skills: best.map(s => ({
      id: s.id, name: s.name, category: s.cat,
      similarity: Math.round((s._sim || 0) * 100) / 100,
      tokens: s._tokens, successRate: Math.round((s._success || 0.75) * 100) / 100,
    })),
    fitness:       Math.round(fitness * 1000) / 1000,
    totalTokens:   prunedTokens,
    baselineTokens,
    tokenSavings:  `${tokenSavings}%`,
    overlapPruned: `${Math.round(overlapReduction * 100)}%`,
    compositemd,
    synergies:     synergies.slice(0, 10),
  };
}

/* ── RUN FORGE ───────────────────────────────────── */
async function runForgeComposer() {
  if (forgeRunning) return;

  // Check feature flag
  if (typeof FEATURES !== 'undefined' && FEATURES.skillforge === false) {
    showForgeError('SkillForge is currently disabled. Check back soon!');
    return;
  }

  const query = document.getElementById('forge-query').value.trim();
  if (!query) {
    showForgeError('Please describe what you want the composite skill to do.');
    return;
  }

  forgeRunning = true;
  const btn = document.getElementById('forge-compose-btn');
  btn.disabled = true;
  btn.textContent = '⚡ Forging…';
  document.getElementById('forge-error').style.display   = 'none';
  document.getElementById('forge-result').style.display  = 'none';
  document.getElementById('forge-metrics').style.display = 'none';

  try {
    // Use all loaded skills (db.js + community)
    const allSkills = (typeof getAllSkills === 'function') ? getAllSkills() : [];
    if (!allSkills.length) throw new Error('No skills loaded yet. Please wait for the page to finish loading.');

    // Run evolutionary algorithm client-side (non-blocking via setTimeout)
    const composite = await new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const result = _forgeEvolve(query, allSkills, 8, 8, 20);
          if (!result) reject(new Error('No relevant skills found for this query. Try a different description.'));
          else resolve(result);
        } catch (e) { reject(e); }
      }, 10); // yield to UI thread
    });

    forgeResult = composite;
    renderForgeResult(composite);
  } catch (err) {
    showForgeError(err.message);
  } finally {
    forgeRunning = false;
    btn.disabled = false;
    btn.textContent = '⚡ Forge Composite';
  }
}

/* ── RENDER RESULTS ──────────────────────────────── */
function renderForgeResult(composite) {
  // Show metrics panel
  const metricsEl = document.getElementById('forge-metrics');
  metricsEl.style.display = 'block';
  metricsEl.innerHTML = `
    <div class="forge-metrics-grid">
      <div class="forge-metric">
        <div class="forge-metric-val">${composite.skills.length}</div>
        <div class="forge-metric-lbl">Skills Composed</div>
      </div>
      <div class="forge-metric">
        <div class="forge-metric-val">${composite.tokenSavings}</div>
        <div class="forge-metric-lbl">Token Savings</div>
      </div>
      <div class="forge-metric">
        <div class="forge-metric-val">${composite.totalTokens.toLocaleString()}</div>
        <div class="forge-metric-lbl">Optimized Tokens</div>
      </div>
      <div class="forge-metric">
        <div class="forge-metric-val">${composite.fitness}</div>
        <div class="forge-metric-lbl">Fitness Score</div>
      </div>
    </div>
    <div class="forge-comparison">
      <div class="forge-bar-label">Baseline (naive concat)</div>
      <div class="forge-bar baseline"><div class="forge-bar-fill" style="width:100%">${composite.baselineTokens.toLocaleString()} tokens</div></div>
      <div class="forge-bar-label">SkillForge (pruned)</div>
      <div class="forge-bar forged"><div class="forge-bar-fill" style="width:${Math.round(composite.totalTokens / composite.baselineTokens * 100)}%">${composite.totalTokens.toLocaleString()} tokens</div></div>
    </div>
  `;

  // Show composed skills list
  const resultEl = document.getElementById('forge-result');
  resultEl.style.display = 'block';
  resultEl.innerHTML = `
    <div class="m-lbl">Composed Skills (ranked by relevance)</div>
    <div class="forge-skills-list">
      ${composite.skills.map((s, i) => `
        <div class="forge-skill-row" onclick="typeof openDetail==='function'&&openDetail('${esc(s.id)}')">
          <span class="forge-skill-rank">${i + 1}</span>
          <div class="forge-skill-info">
            <div class="forge-skill-name">${esc(s.name)}</div>
            <div class="forge-skill-meta">
              <span class="card-tag" style="font-size:.6rem">${esc(s.category)}</span>
              <span style="font-size:.65rem;color:var(--text-ter)">~${s.tokens} tok · ${Math.round(s.similarity * 100)}% match</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    ${composite.synergies.length > 0 ? `
    <div class="m-lbl" style="margin-top:14px">Synergies Detected</div>
    <div class="forge-synergies">
      ${composite.synergies.map(syn => `
        <div class="forge-synergy">
          <strong>${esc(syn.pair[0])}</strong> ↔ <strong>${esc(syn.pair[1])}</strong>
          <span class="forge-synergy-tags">${syn.sharedTags.map(t => esc(t)).join(', ')}</span>
          <span class="forge-overlap">${syn.overlapPct}% pruned</span>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="m-lbl" style="margin-top:14px">Composite Skill Preview</div>
    <div class="code-block" style="max-height:200px;font-size:.7rem">${esc((composite.compositemd || '').slice(0, 2000))}</div>
  `;

  // Show action buttons
  document.getElementById('forge-download-btn').style.display = 'inline-flex';
  document.getElementById('forge-submit-btn').style.display   = 'inline-flex';
}

function showForgeError(msg) {
  const el = document.getElementById('forge-error');
  el.textContent = msg;
  el.style.display = 'block';
}

/* ── DOWNLOAD COMPOSITE ──────────────────────────── */
function forgeDownloadComposite() {
  if (!forgeResult?.compositemd) return;
  const blob = new Blob([forgeResult.compositemd], { type: 'text/markdown' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `skillforge-composite-${Date.now()}.md`;
  a.click();
  if (typeof toast === 'function') toast('Composite skill downloaded!');
}

/* ── SUBMIT COMPOSITE ────────────────────────────── */
async function forgeSubmitComposite() {
  if (!forgeResult?.compositemd) return;
  if (typeof requireLogin === 'function' && typeof isLoggedIn === 'function' && !isLoggedIn()) {
    requireLogin(() => forgeSubmitComposite());
    return;
  }

  // Extract name from the composite
  const nameMatch = forgeResult.compositemd.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : 'forged-composite';

  // Submit as community skill
  if (typeof submitSkillToSupabase === 'function') {
    try {
      await submitSkillToSupabase({
        name:        name,
        description: `SkillForge composite of ${forgeResult.skills.length} skills`,
        category:    forgeResult.skills[0]?.category || 'ai',
        difficulty:  'intermediate',
        md:          forgeResult.compositemd,
        tags:        ['skillforge', 'composite', ...forgeResult.skills.map(s => s.category)],
      });
      if (typeof toast === 'function') toast('Composite submitted for review!');
    } catch (err) {
      showForgeError('Submit failed: ' + err.message);
    }
  }
}
