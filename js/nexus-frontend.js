/**
 * SkillForge Nexus — Frontend Integration
 * Client-side logic for the Nexus graph-based composition engine.
 */

let nexusResult = null;
let nexusRunning = false;

function openNexusModal() {
  document.getElementById('nexusOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  nexusResult = null;
  nexusRunning = false;
  document.getElementById('nexus-query').value = '';
  document.getElementById('nexus-result').style.display = 'none';
  document.getElementById('nexus-error').style.display = 'none';
  document.getElementById('nexus-metrics').style.display = 'none';
  document.getElementById('nexus-recommend-btn').disabled = false;
  document.getElementById('nexus-recommend-btn').textContent = '🔮 Nexus Recommend';
  document.getElementById('nexus-download-btn').style.display = 'none';
  document.getElementById('nexus-submit-btn').style.display = 'none';
}

function closeNexusModal() {
  document.getElementById('nexusOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function runNexusRecommend() {
  if (nexusRunning) return;
  const query = document.getElementById('nexus-query')?.value?.trim();
  if (!query) {
    showNexusError('Please describe what you need.');
    return;
  }

  nexusRunning = true;
  const btn = document.getElementById('nexus-recommend-btn');
  btn.disabled = true;
  btn.textContent = '🔮 Analyzing graph…';
  document.getElementById('nexus-error').style.display = 'none';
  document.getElementById('nexus-result').style.display = 'none';
  document.getElementById('nexus-metrics').style.display = 'none';

  try {
    const res = await fetch('/api/nexus-recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK: 5 }),
    });
    const data = await res.json();

    if (data?.error) {
      showNexusError(data.error);
      return;
    }

    if (!data?.recommendations?.length && !data?.metaSkills?.length) {
      showNexusError('No matching skills found. Try a different query.');
      return;
    }

    nexusResult = data;
    renderNexusResult(data);
  } catch (err) {
    showNexusError('Error: ' + err.message);
  } finally {
    nexusRunning = false;
    btn.disabled = false;
    btn.textContent = '🔮 Nexus Recommend';
  }
}

function renderNexusResult(data) {
  const metricsEl = document.getElementById('nexus-metrics');
  metricsEl.style.display = 'block';
  metricsEl.innerHTML = `
    <div class="nexus-metrics-grid">
      <div class="nexus-metric">
        <div class="nexus-metric-val">${data.stats?.tokenSavings || 0}%</div>
        <div class="nexus-metric-lbl">Token Savings</div>
      </div>
      <div class="nexus-metric">
        <div class="nexus-metric-val">${data.stats?.baselineTokens || 0}</div>
        <div class="nexus-metric-lbl">Baseline Tokens</div>
      </div>
      <div class="nexus-metric">
        <div class="nexus-metric">
        <div class="nexus-metric-val">${data.stats?.optimizedTokens || 0}</div>
        <div class="nexus-metric-lbl">Optimized Tokens</div>
      </div>
      <div class="nexus-metric">
        <div class="nexus-metric-val">${(data.stats?.avgNexusScore || 0).toFixed(2)}</div>
        <div class="nexus-metric-lbl">Avg Nexus Score</div>
      </div>
    </div>
    <div class="nexus-comparison">
      <div class="nexus-bar-label">Baseline (naive concat)</div>
      <div class="nexus-bar baseline"><div class="nexus-bar-fill" style="width:100%">~${data.stats?.baselineTokens || 0} tokens</div></div>
      <div class="nexus-bar-label">Nexus Optimized</div>
      <div class="nexus-bar nexus-opt"><div class="nexus-bar-fill" style="width:${Math.round((data.stats?.optimizedTokens || 0) / Math.max(1, data.stats?.baselineTokens || 1) * 100)}%">~${data.stats?.optimizedTokens || 0} tokens</div></div>
    </div>
  `;

  const resultEl = document.getElementById('nexus-result');
  resultEl.style.display = 'block';
  let html = '';

  if (data.recommendations?.length) {
    html += `<div class="m-lbl">Top Recommendations (by Nexus Score)</div>`;
    html += `<div class="nexus-skills-list">`;
    data.recommendations.forEach((r, i) => {
      html += `
        <div class="nexus-skill-row" onclick="typeof openDetail==='function'&&openDetail('${esc(r.id)}')">
          <span class="nexus-skill-rank">${i + 1}</span>
          <div class="nexus-skill-info">
            <div class="nexus-skill-name">${esc(r.name)}</div>
            <div class="nexus-skill-meta">
              <span class="card-tag" style="font-size:.6rem">${esc(r.cat)}</span>
              <span style="font-size:.65rem;color:var(--text-ter)">Score: ${r.nexusScore?.toFixed(3)} · ~${r.tokenEstimate} tok · ${Math.round(r.successRate * 100)}% success</span>
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  if (data.metaSkills?.length) {
    html += `<div class="m-lbl" style="margin-top:14px">Synthesized Meta-Skills</div>`;
    html += `<div class="nexus-meta-list">`;
    data.metaSkills.forEach((m, i) => {
      html += `
        <div class="nexus-meta-card">
          <div class="nexus-meta-header">
            <span class="nexus-meta-name">${esc(m.name)}</span>
            <span class="nexus-meta-score">Score: ${m.nexus_score?.toFixed(3)}</span>
          </div>
          <div class="nexus-meta-stats">
            <span>🔗 ${m.path?.length || 0} skills</span>
            <span>💾 ${m.token_savings || 0}% token savings</span>
          </div>
          <div class="nexus-meta-skills">
            ${(m.path || []).map(s => `<span class="card-tag">${esc(s.name)}</span>`).join(' ')}
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  resultEl.innerHTML = html;
  document.getElementById('nexus-download-btn').style.display = 'inline-flex';
  document.getElementById('nexus-submit-btn').style.display = 'inline-flex';
}

function showNexusError(msg) {
  const el = document.getElementById('nexus-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function nexusDownloadResult() {
  if (!nexusResult) return;
  let content = `# SkillForge Nexus Results\n\nQuery: "${nexusResult.query || ''}"\n\n`;
  
  if (nexusResult.recommendations?.length) {
    content += `## Top Recommendations\n\n`;
    nexusResult.recommendations.forEach((r, i) => {
      content += `${i + 1}. ${r.name} (${r.id})\n   Category: ${r.cat} | Nexus Score: ${r.nexusScore?.toFixed(3)}\n\n`;
    });
  }
  
  if (nexusResult.metaSkills?.length) {
    content += `\n## Synthesized Meta-Skills\n\n`;
    nexusResult.metaSkills.forEach((m, i) => {
      content += `### ${i + 1}. ${m.name}\n`;
      content += `Nexus Score: ${m.nexus_score?.toFixed(3)} | Token Savings: ${m.token_savings}%\n\n`;
      if (m.compositemd) {
        content += m.compositemd + '\n\n';
      }
    });
  }

  const blob = new Blob([content], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nexus-results-${Date.now()}.md`;
  a.click();
  toast('Nexus results downloaded!');
}

function nexusSubmitMetaSkill() {
  if (!nexusResult?.metaSkills?.length) return;
  const meta = nexusResult.metaSkills[0];
  
  closeNexusModal();
  openSubmit();
  
  setTimeout(() => {
    const hiddenMd = document.getElementById('generatedMd') || (() => {
      const inp = document.createElement('input');
      inp.type = 'hidden'; inp.id = 'generatedMd';
      document.getElementById('submitForm')?.appendChild(inp);
      return inp;
    })();
    hiddenMd.value = meta.compositemd || '';

    const fm = parseFrontmatter ? parseFrontmatter(meta.compositemd || '') : {};
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    setVal('f-name', (fm.name || '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    setVal('f-desc', fm.description);
    setVal('f-tags', fm.tags || '');

    switchTab('form');
    toast('Meta-skill loaded into submit form!');
  }, 350);
}
