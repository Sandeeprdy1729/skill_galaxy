/**
 * SkillGalaxy — galaxy-viz.js
 * Interactive D3.js force-directed galaxy visualization.
 * Skills are stars, categories are constellations.
 * No AI API required.
 */

let galaxyInitialized = false;
let galaxySim = null;

function showGalaxyView() {
  document.getElementById('galaxyOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (!galaxyInitialized) {
    setTimeout(() => initGalaxy(), 100);
    galaxyInitialized = true;
  }
}

function closeGalaxyView() {
  document.getElementById('galaxyOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
  if (galaxySim) { galaxySim.stop(); }
}

function initGalaxy() {
  const container = document.getElementById('galaxyContainer');
  if (!container || typeof d3 === 'undefined') {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-ter);font-size:.85rem">D3.js not loaded. Please refresh.</div>';
    return;
  }

  container.innerHTML = '';
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Sample skills for performance (max 500 for smooth rendering)
  const allSkills = (typeof getAllSkills === 'function') ? getAllSkills() : [];
  const MAX_NODES = 500;
  const sampled = allSkills.length > MAX_NODES ? sampleSkills(allSkills, MAX_NODES) : allSkills;

  // Get category colors
  const cats = typeof CATEGORIES !== 'undefined' ? CATEGORIES : {};
  const catKeys = Object.keys(cats);

  // Create nodes
  const nodes = sampled.map(s => ({
    id: s.id,
    name: s.name,
    cat: s.cat,
    desc: (s.desc || '').slice(0, 80),
    diff: s.difficulty || 'intermediate',
    r: diffRadius(s.difficulty),
    color: cats[s.cat]?.dot || '#999',
  }));

  // Create category center nodes (invisible attractors)
  const catCenters = catKeys.map((k, i) => {
    const angle = (2 * Math.PI * i) / catKeys.length;
    const dist = Math.min(width, height) * 0.32;
    return {
      id: '_cat_' + k,
      cat: k,
      isCatCenter: true,
      fx: width / 2 + Math.cos(angle) * dist,
      fy: height / 2 + Math.sin(angle) * dist,
      r: 0,
      color: cats[k]?.dot || '#999',
      label: cats[k]?.label || k,
    };
  });

  const allNodes = [...catCenters, ...nodes];

  // Create links (skill → its category center)
  const links = nodes.map(n => ({
    source: '_cat_' + n.cat,
    target: n.id,
    strength: 0.03,
  }));

  // SVG
  const svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height);

  // Background
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'transparent');

  // Zoom
  const g = svg.append('g');
  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);

  // Tooltip
  const tooltip = d3.select(container).append('div')
    .attr('class', 'galaxy-tooltip')
    .style('display', 'none');

  // Simulation
  const sim = d3.forceSimulation(allNodes)
    .force('link', d3.forceLink(links).id(d => d.id).strength(d => d.strength))
    .force('charge', d3.forceManyBody().strength(d => d.isCatCenter ? 0 : -12))
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.01))
    .force('collision', d3.forceCollide().radius(d => d.r + 2))
    .force('x', d3.forceX(width / 2).strength(0.01))
    .force('y', d3.forceY(height / 2).strength(0.01))
    .alphaDecay(0.015);

  galaxySim = sim;

  // Draw links (very faint)
  const linkEl = g.append('g')
    .selectAll('line')
    .data(links)
    .enter().append('line')
    .attr('stroke', '#ddd')
    .attr('stroke-opacity', 0.15)
    .attr('stroke-width', 0.5);

  // Category labels
  const catLabels = g.append('g')
    .selectAll('text')
    .data(catCenters)
    .enter().append('text')
    .attr('text-anchor', 'middle')
    .attr('font-size', '11px')
    .attr('font-weight', '600')
    .attr('fill', d => d.color)
    .attr('opacity', 0.8)
    .text(d => d.label);

  // Draw nodes
  const nodeEl = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .enter().append('circle')
    .attr('r', d => d.r)
    .attr('fill', d => d.color)
    .attr('stroke', 'white')
    .attr('stroke-width', 0.5)
    .attr('opacity', 0.85)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', d.r * 1.5).attr('opacity', 1);
      tooltip.style('display', 'block')
        .html(`<div class="gt-name">${esc(d.name)}</div><div class="gt-cat">${cats[d.cat]?.label || d.cat} · ${d.diff}</div>`)
        .style('left', (event.offsetX + 15) + 'px')
        .style('top', (event.offsetY - 10) + 'px');
    })
    .on('mouseout', function(event, d) {
      d3.select(this).attr('r', d.r).attr('opacity', 0.85);
      tooltip.style('display', 'none');
    })
    .on('click', function(event, d) {
      closeGalaxyView();
      setTimeout(() => { if (typeof openDetail === 'function') openDetail(d.id); }, 200);
    })
    .call(d3.drag()
      .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.1).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  // Tick
  sim.on('tick', () => {
    linkEl
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    nodeEl
      .attr('cx', d => d.x).attr('cy', d => d.y);
    catLabels
      .attr('x', d => d.fx).attr('y', d => d.fy - 8);
  });

  // Legend
  const legendHtml = catKeys.map(k =>
    `<span class="galaxy-legend-item"><span class="galaxy-legend-dot" style="background:${cats[k]?.dot||'#999'}"></span>${cats[k]?.label||k}</span>`
  ).join('');
  d3.select(container).append('div')
    .attr('class', 'galaxy-legend')
    .html(legendHtml);
}

function diffRadius(diff) {
  switch(diff) {
    case 'beginner': return 3;
    case 'intermediate': return 4.5;
    case 'advanced': return 6;
    case 'expert': return 8;
    default: return 4;
  }
}

function sampleSkills(skills, max) {
  // Stratified sample: proportional from each category
  const cats = {};
  skills.forEach(s => { (cats[s.cat] = cats[s.cat] || []).push(s); });
  const catKeys = Object.keys(cats);
  const perCat = Math.max(5, Math.floor(max / catKeys.length));
  const result = [];
  for (const k of catKeys) {
    const arr = cats[k];
    // Shuffle deterministically and take first N
    const shuffled = arr.slice().sort((a, b) => a.id.localeCompare(b.id));
    result.push(...shuffled.slice(0, perCat));
  }
  return result.slice(0, max);
}
