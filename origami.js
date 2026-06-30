// ============================================================
//  ORIGAMI GALLERY  -  controller
// ============================================================

const IMAGE_DIR = 'origami_images';
let allModels = [];
let byId = {};
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

const filters = { difficulty: '', designer: '', paper: '', sort: 'recent' };

const DIFF_EMOJI = { 1: '\uD83D\uDD4A\uFE0F', 2: '\uD83C\uDF38', 3: '\uD83D\uDC1F', 4: '\uD83E\uDD8A', 5: '\uD83D\uDC09' };

// ---------- helpers ----------
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizeImagePath(imagePath) {
    if (!imagePath) return '';
    let clean = imagePath.trim().replace(/\\/g, '/');
    if (/^(https?:\/\/|data:)/i.test(clean)) return clean;
    if (clean.startsWith('./')) clean = clean.slice(2);
    if (clean.startsWith('/')) clean = clean.slice(1);
    if (!clean.startsWith(IMAGE_DIR + '/')) clean = `${IMAGE_DIR}/${clean}`;
    return clean;
}

function starsHtml(d) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= d ? '\u2605' : '<span class="off">\u2605</span>';
    return s;
}

// ---------- init ----------
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('origami.json');
        allModels = await res.json();
        allModels.forEach((m, i) => { m._order = i; byId[m.id] = m; });

        populateFilterOptions();
        bindControls();
        render();

        window.addEventListener('hashchange', handleRouting);
        handleRouting();
    } catch (err) {
        console.error('Failed to load origami models:', err);
        document.getElementById('grid').innerHTML = '<p>Could not load the gallery. Check the console.</p>';
    }
});

function uniqueSorted(key) {
    return [...new Set(allModels.map(m => m[key]).filter(Boolean))].sort();
}

function populateFilterOptions() {
    const dSel = document.getElementById('fDesigner');
    uniqueSorted('designer').forEach(d => {
        const o = document.createElement('option'); o.value = d; o.textContent = d; dSel.appendChild(o);
    });
    const pSel = document.getElementById('fPaper');
    uniqueSorted('paper').forEach(p => {
        const o = document.createElement('option'); o.value = p; o.textContent = p; pSel.appendChild(o);
    });
}

function bindControls() {
    document.getElementById('fDifficulty').addEventListener('change', e => { filters.difficulty = e.target.value; render(); });
    document.getElementById('fDesigner').addEventListener('change', e => { filters.designer = e.target.value; render(); });
    document.getElementById('fPaper').addEventListener('change', e => { filters.paper = e.target.value; render(); });
    document.getElementById('fSort').addEventListener('change', e => { filters.sort = e.target.value; render(); });
    document.getElementById('clearFilters').addEventListener('click', () => {
        filters.difficulty = filters.designer = filters.paper = '';
        filters.sort = 'recent';
        document.getElementById('fDifficulty').value = '';
        document.getElementById('fDesigner').value = '';
        document.getElementById('fPaper').value = '';
        document.getElementById('fSort').value = 'recent';
        render();
    });

    // lightbox close
    document.getElementById('lbClose').addEventListener('click', closeLightbox);
    document.getElementById('lbBackdrop').addEventListener('click', e => {
        if (e.target.id === 'lbBackdrop') closeLightbox();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !document.getElementById('lbBackdrop').hidden) closeLightbox();
    });
}

function applyFilters() {
    let list = allModels.filter(m =>
        (!filters.difficulty || String(m.difficulty) === filters.difficulty) &&
        (!filters.designer || m.designer === filters.designer) &&
        (!filters.paper || m.paper === filters.paper)
    );
    switch (filters.sort) {
        case 'diff-desc': list.sort((a, b) => b.difficulty - a.difficulty); break;
        case 'diff-asc': list.sort((a, b) => a.difficulty - b.difficulty); break;
        case 'folds-desc': list.sort((a, b) => (b.folds || 0) - (a.folds || 0)); break;
        default: list.sort((a, b) => a._order - b._order);
    }
    return list;
}

// ---------- render grid ----------
function render() {
    const grid = document.getElementById('grid');
    const list = applyFilters();
    document.getElementById('count').textContent =
        `${list.length} model${list.length === 1 ? '' : 's'}`;

    grid.innerHTML = '';
    list.forEach(m => grid.appendChild(buildCard(m)));
}

function frontFace(m) {
    const img = normalizeImagePath(m.image);
    if (img) {
        return `<div class="face-img" style="background-image:url('${img}')"></div>`;
    }
    return `<div class="face-img ph-paper"><span class="ph-emoji" aria-hidden="true">${DIFF_EMOJI[m.difficulty] || '\uD83E\uDDFB'}</span></div>`;
}

function backFace(m) {
    const cp = normalizeImagePath(m.creasePattern);
    const style = cp ? `style="background-image:url('${cp}')"` : '';
    const cls = cp ? '' : 'ph-crease';
    return `
        <div class="face-img ${cls}" ${style}></div>
        <div class="face-body">
            <span class="cp-label">Crease Pattern</span>
            <span class="cp-notes">${escapeHtml(m.notes || '')}</span>
            <span class="cp-foot">${m.folds || '?'} folds &middot; ${escapeHtml(m.paper || '')}</span>
        </div>`;
}

function buildCard(m) {
    const wrap = document.createElement('div');
    wrap.className = 'org-card-wrap';
    wrap.innerHTML = `
        <div class="flip" tabindex="0" role="button" aria-label="${escapeHtml(m.title)} by ${escapeHtml(m.designer)} - open details">
            <span class="flip-hint">flip</span>
            <div class="flip-inner">
                <div class="flip-face flip-front">
                    ${frontFace(m)}
                    <div class="face-caption">
                        <div class="fc-title">${escapeHtml(m.title)}</div>
                        <div class="fc-sub">${escapeHtml(m.designer)}</div>
                        <div class="fc-meta">
                            <span class="stars" title="Difficulty ${m.difficulty}/5">${starsHtml(m.difficulty)}</span>
                            <span class="fold-badge">${m.folds || '?'} folds</span>
                        </div>
                    </div>
                </div>
                <div class="flip-face flip-back">
                    ${backFace(m)}
                </div>
            </div>
        </div>`;

    const flip = wrap.querySelector('.flip');

    if (isTouch) {
        // first tap flips, second tap (when flipped) opens the lightbox
        flip.addEventListener('click', () => {
            if (flip.classList.contains('flipped')) openLightbox(m.id);
            else flip.classList.add('flipped');
        });
    } else {
        flip.addEventListener('click', () => openLightbox(m.id));
    }
    flip.addEventListener('keydown', e => { if (e.key === 'Enter') openLightbox(m.id); });

    return wrap;
}

// ---------- lightbox / routing ----------
function openLightbox(id) {
    if (location.hash === '#model-' + id) renderLightbox(id);
    else location.hash = 'model-' + id;
}

function closeLightbox() {
    if (location.hash.startsWith('#model-')) {
        history.pushState('', document.title, location.pathname + location.search);
    }
    hideLightbox();
}

function handleRouting() {
    const hash = window.location.hash;
    if (hash.startsWith('#model-')) renderLightbox(hash.replace('#model-', ''));
    else hideLightbox();
}

function hideLightbox() {
    const b = document.getElementById('lbBackdrop');
    b.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => { if (!b.classList.contains('show')) b.hidden = true; }, 300);
}

function renderLightbox(id) {
    const m = byId[id];
    const b = document.getElementById('lbBackdrop');
    if (!m) { hideLightbox(); return; }

    // gather images: finished + angles + crease pattern
    const imgs = [];
    const main = normalizeImagePath(m.image);
    if (main) imgs.push({ url: main, label: 'Finished' });
    (m.angles || []).forEach((a, i) => { const u = normalizeImagePath(a); if (u) imgs.push({ url: u, label: 'Angle ' + (i + 1) }); });
    const cp = normalizeImagePath(m.creasePattern);
    if (cp) imgs.push({ url: cp, label: 'Crease Pattern', crease: true });

    const mainEl = document.getElementById('lbMain');
    const setMain = src => {
        if (src && src.url) mainEl.setAttribute('style', `background-image:url('${src.url}')`);
        else mainEl.setAttribute('style', 'background:linear-gradient(135deg,#fbf7ee,#e7dcc6)');
    };
    setMain(imgs[0]);

    const thumbs = document.getElementById('lbThumbs');
    thumbs.innerHTML = '';
    imgs.forEach((im, i) => {
        const t = document.createElement('div');
        t.className = 'lb-thumb' + (i === 0 ? ' active' : '');
        t.style.backgroundImage = `url('${im.url}')`;
        t.title = im.label;
        t.addEventListener('click', () => {
            setMain(im);
            thumbs.querySelectorAll('.lb-thumb').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
        });
        thumbs.appendChild(t);
    });
    thumbs.style.display = imgs.length > 1 ? 'flex' : 'none';

    document.getElementById('lbTitle').textContent = m.title;
    document.getElementById('lbDesigner').textContent = 'Designed by ' + m.designer;
    document.getElementById('lbStats').innerHTML = `
        <div class="lb-stat"><div class="k">Difficulty</div><div class="v"><span class="stars">${starsHtml(m.difficulty)}</span></div></div>
        <div class="lb-stat"><div class="k">Folds / Steps</div><div class="v">${m.folds || '?'}</div></div>
        <div class="lb-stat"><div class="k">Paper</div><div class="v">${escapeHtml(m.paper || '\u2014')}</div></div>
        <div class="lb-stat"><div class="k">Designer</div><div class="v">${escapeHtml(m.designer || '\u2014')}</div></div>`;
    document.getElementById('lbNotes').textContent = m.notes || '';

    const diag = document.getElementById('lbDiagram');
    if (m.diagramUrl && m.diagramUrl !== '#') {
        diag.style.display = '';
        diag.href = m.diagramUrl;
    } else {
        diag.style.display = 'none';
    }

    b.hidden = false;
    requestAnimationFrame(() => b.classList.add('show'));
    document.body.style.overflow = 'hidden';
}
