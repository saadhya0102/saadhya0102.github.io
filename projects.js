// ============================================================
//  PROJECT GALLERY  -  Netflix-style controller
// ============================================================

const IMAGE_DIR = 'projects_images';
let allProjects = [];
let categoryOrder = [];
let byId = {};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Deterministic placeholder gradients (used when a project has no image)
const PLACEHOLDER_GRADS = [
    'linear-gradient(135deg, #5a3f8c, #1b1430)',
    'linear-gradient(135deg, #8c3f4f, #2a1014)',
    'linear-gradient(135deg, #3f6c8c, #101e2a)',
    'linear-gradient(135deg, #8c6b3f, #2a1f10)',
    'linear-gradient(135deg, #3f8c6b, #102a20)',
    'linear-gradient(135deg, #6b3f8c, #1d102a)',
    'linear-gradient(135deg, #8c8c3f, #2a2a10)',
    'linear-gradient(135deg, #3f5a8c, #10182a)'
];

// ---------- helpers ----------
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
}

function gradFor(p) {
    return PLACEHOLDER_GRADS[hashCode(p.id || p.title || '') % PLACEHOLDER_GRADS.length];
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

// Returns inline CSS for a card/hero background; falls back to a gradient.
function bgStyleFor(p, useImage) {
    const img = useImage ? normalizeImagePath(p.image) : '';
    if (img) {
        return `background-image: linear-gradient(rgba(0,0,0,0.05), rgba(0,0,0,0.2)), url('${img}'); background-color:#222;`;
    }
    return `background-image: ${gradFor(p)};`;
}

function genreText(p) {
    return (p.tags || []).slice(0, 3).map(t => `<span>${escapeHtml(t)}</span>`).join('');
}

// ---------- init ----------
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('projects.json');
        const data = await res.json();
        allProjects = (data.projects || []).map(p => ({ ...p }));
        categoryOrder = data.categoryOrder || [];
        byId = {};
        allProjects.forEach(p => { byId[p.id] = p; });

        renderBillboard();
        renderRows();
        setupNavbar();
        setupSearch();

        window.addEventListener('hashchange', handleRouting);
        handleRouting();
    } catch (err) {
        console.error('Failed to load projects:', err);
        document.getElementById('rows').innerHTML =
            '<p style="padding:2rem clamp(1rem,4vw,3.5rem);color:#b3b3b3">Could not load projects. Check the console.</p>';
    }
});

// ---------- billboard ----------
function getFeatured() {
    return allProjects.find(p => p.featured) || allProjects[0];
}

function renderBillboard() {
    const p = getFeatured();
    if (!p) return;
    const bb = document.getElementById('billboard');
    bb.removeAttribute('style');
    bb.innerHTML = `
        <div class="nfx-bb-bg" style="${bgStyleFor(p, true)}"></div>
        <div class="nfx-bb-content">
            <div class="nfx-bb-tagline">Featured Project</div>
            <h1 class="nfx-bb-title">${escapeHtml(p.title)}</h1>
            <div class="nfx-bb-tags">
                <span style="color:#46d369;font-weight:700">${p.match || 95}% Match</span>
                <span>${escapeHtml(p.year || '')}</span>
                <span>${escapeHtml((p.tags || []).slice(0, 3).join(' \u00b7 '))}</span>
            </div>
            <p class="nfx-bb-desc">${escapeHtml(p.synopsis || '')}</p>
            <div class="nfx-bb-actions">
                <button class="nfx-btn nfx-btn-play" id="bbPlay">&#9658; Play</button>
                <button class="nfx-btn nfx-btn-info" id="bbInfo">&#9432; More Info</button>
            </div>
        </div>`;
    const primary = (p.links || []).find(l => l.url && l.url !== '#');
    document.getElementById('bbPlay').addEventListener('click', () => {
        if (primary) window.open(primary.url, '_blank', 'noopener');
        else openModal(p.id);
    });
    document.getElementById('bbInfo').addEventListener('click', () => openModal(p.id));
}

// ---------- rows ----------
function projectsInCategory(cat) {
    return allProjects.filter(p => (p.categories || []).includes(cat));
}

function renderRows() {
    const container = document.getElementById('rows');
    container.innerHTML = '';

    // Synthesized "Trending Now" row (top by match)
    const trending = [...allProjects].sort((a, b) => (b.match || 0) - (a.match || 0)).slice(0, 8);
    container.appendChild(buildRow('Trending Now', trending));

    categoryOrder.forEach(cat => {
        if (cat === 'Featured') return; // reserved for billboard
        const items = projectsInCategory(cat);
        if (items.length) container.appendChild(buildRow(cat, items));
    });
}

function buildRow(title, items) {
    const row = document.createElement('section');
    row.className = 'nfx-row';

    const titleEl = document.createElement('h2');
    titleEl.className = 'nfx-row-title';
    titleEl.textContent = title;
    row.appendChild(titleEl);

    const viewport = document.createElement('div');
    viewport.className = 'nfx-row-viewport';

    const leftBtn = document.createElement('button');
    leftBtn.className = 'nfx-arrow left';
    leftBtn.setAttribute('aria-label', 'Scroll left');
    leftBtn.innerHTML = '&#8249;';

    const rightBtn = document.createElement('button');
    rightBtn.className = 'nfx-arrow right';
    rightBtn.setAttribute('aria-label', 'Scroll right');
    rightBtn.innerHTML = '&#8250;';

    const track = document.createElement('div');
    track.className = 'nfx-row-track';
    items.forEach(p => track.appendChild(buildCard(p)));

    // Transform-based scrolling (desktop). Touch devices use native scroll (CSS).
    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    let offset = 0;
    const minOffset = () => Math.min(0, viewport.clientWidth - track.scrollWidth);
    const step = () => viewport.clientWidth * 0.82;
    const apply = () => { if (!isTouch) track.style.transform = `translateX(${offset}px)`; };
    const updateArrows = () => {
        leftBtn.style.visibility = offset < 0 ? 'visible' : 'hidden';
        rightBtn.style.visibility = offset > minOffset() ? 'visible' : 'hidden';
    };

    leftBtn.addEventListener('click', () => {
        offset = Math.min(0, offset + step());
        apply(); updateArrows();
    });
    rightBtn.addEventListener('click', () => {
        offset = Math.max(minOffset(), offset - step());
        apply(); updateArrows();
    });
    track._resetOffset = () => { offset = 0; apply(); updateArrows(); };

    viewport.appendChild(leftBtn);
    viewport.appendChild(track);
    viewport.appendChild(rightBtn);
    row.appendChild(viewport);
    // initialize arrow visibility after layout settles
    requestAnimationFrame(updateArrows);
    return row;
}

function buildCard(p) {
    const card = document.createElement('article');
    card.className = 'nfx-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${p.title} - open details`);

    const hasImg = !!normalizeImagePath(p.image);
    const fallback = hasImg ? '' : `<span class="nfx-card-fallback-label">${escapeHtml(p.title)}</span>`;

    card.innerHTML = `
        <div class="nfx-card-img" style="${bgStyleFor(p, true)}">${fallback}</div>
        <div class="nfx-card-info">
            <div class="nfx-card-actions">
                <button class="nfx-icon-btn play" title="Play" data-act="play">&#9658;</button>
                <button class="nfx-icon-btn" title="Add to list" data-act="add">&#43;</button>
                <button class="nfx-icon-btn" title="Like" data-act="like">&#128077;</button>
                <button class="nfx-icon-btn more" title="More info" data-act="more">&#8964;</button>
            </div>
            <div class="nfx-card-line">
                <span class="nfx-card-match">${p.match || 90}% Match</span>
                <span class="yr">${escapeHtml(p.year || '')}</span>
            </div>
            <div class="nfx-card-genres">${genreText(p)}</div>
        </div>`;

    // edge-aware transform-origin so first/last cards don't clip
    card.addEventListener('mouseenter', () => {
        const track = card.parentElement;
        const cards = [...track.children];
        const idx = cards.indexOf(card);
        if (idx === 0) card.style.transformOrigin = 'left center';
        else if (idx === cards.length - 1) card.style.transformOrigin = 'right center';
        else card.style.transformOrigin = 'center center';
    });

    const open = () => openModal(p.id);
    card.querySelector('.nfx-card-img').addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });

    card.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const act = btn.dataset.act;
            if (act === 'play') {
                const primary = (p.links || []).find(l => l.url && l.url !== '#');
                if (primary) window.open(primary.url, '_blank', 'noopener');
                else openModal(p.id);
            } else if (act === 'more') {
                openModal(p.id);
            } else {
                // add / like -> subtle confirmation
                btn.textContent = '\u2713';
                btn.style.borderColor = '#fff';
            }
        });
    });

    return card;
}

// ---------- navbar scroll fade ----------
function setupNavbar() {
    const nav = document.getElementById('nfxNav');
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Reset row offsets on resize so cards never get stranded off-screen
    let rt;
    window.addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
            document.querySelectorAll('.nfx-row-track').forEach(t => { if (t._resetOffset) t._resetOffset(); });
        }, 150);
    });
}

// ---------- search ----------
function setupSearch() {
    const wrap = document.querySelector('.nfx-search');
    const toggle = document.getElementById('searchToggle');
    const input = document.getElementById('searchInput');

    const openSearch = () => {
        wrap.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        input.focus();
    };
    toggle.addEventListener('click', openSearch);
    toggle.addEventListener('keydown', e => { if (e.key === 'Enter') openSearch(); });

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (!q) { renderRows(); return; }
        const matches = allProjects.filter(p =>
            p.title.toLowerCase().includes(q) ||
            (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
            (p.categories || []).some(c => c.toLowerCase().includes(q)) ||
            (p.synopsis || '').toLowerCase().includes(q)
        );
        const container = document.getElementById('rows');
        container.innerHTML = '';
        if (matches.length) {
            container.appendChild(buildRow(`Results for "${input.value.trim()}"`, matches));
        } else {
            container.innerHTML = `<p style="padding:2rem clamp(1rem,4vw,3.5rem);color:#b3b3b3">No projects match "${escapeHtml(input.value.trim())}".</p>`;
        }
    });

    input.addEventListener('blur', () => {
        if (!input.value.trim()) {
            wrap.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
            renderRows();
        }
    });
}

// ---------- modal / routing ----------
function openModal(id) {
    if (location.hash === '#project-' + id) renderModal(id);
    else location.hash = 'project-' + id;
}

function closeModal() {
    if (location.hash.startsWith('#project-')) {
        history.pushState('', document.title, location.pathname + location.search);
    }
    hideModal();
}

function handleRouting() {
    const hash = window.location.hash;
    if (hash.startsWith('#project-')) {
        renderModal(hash.replace('#project-', ''));
    } else {
        hideModal();
    }
}

function hideModal() {
    const backdrop = document.getElementById('modalBackdrop');
    backdrop.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => { if (!backdrop.classList.contains('show')) backdrop.hidden = true; }, 300);
}

function renderModal(id) {
    const p = byId[id];
    const backdrop = document.getElementById('modalBackdrop');
    if (!p) { hideModal(); return; }

    document.getElementById('modalHero').setAttribute('style', bgStyleFor(p, true));
    document.getElementById('modalTitle').textContent = p.title;

    // hero actions
    const primary = (p.links || []).find(l => l.url && l.url !== '#');
    document.getElementById('modalHeroActions').innerHTML = `
        <button class="nfx-link-btn primary" id="modalPlay">&#9658; Play</button>
        <button class="nfx-icon-btn" title="Add to list" id="modalAdd">&#43;</button>
        <button class="nfx-icon-btn" title="Like" id="modalLike">&#128077;</button>`;
    document.getElementById('modalPlay').addEventListener('click', () => {
        if (primary) window.open(primary.url, '_blank', 'noopener');
    });
    document.getElementById('modalAdd').addEventListener('click', e => { e.currentTarget.textContent = '\u2713'; });
    document.getElementById('modalLike').addEventListener('click', e => { e.currentTarget.style.borderColor = '#fff'; });

    document.getElementById('modalMeta').innerHTML = `
        <span class="match">${p.match || 90}% Match</span>
        <span class="yr">${escapeHtml(p.year || '')}</span>
        <span>${(p.tags || []).map(escapeHtml).join(' \u00b7 ')}</span>`;
    document.getElementById('modalSynopsis').textContent = p.synopsis || '';

    // side: links + categories
    const linksHtml = (p.links || []).map(l => {
        const valid = l.url && l.url !== '#';
        return `<a class="nfx-link-btn" href="${valid ? escapeHtml(l.url) : '#'}" ${valid ? 'target="_blank" rel="noopener"' : 'aria-disabled="true"'}>${escapeHtml(l.label)}</a>`;
    }).join('');
    document.getElementById('modalSide').innerHTML = `
        <div style="margin-bottom:0.9rem">
            <span class="lbl">Categories: </span>${(p.categories || []).filter(c => c !== 'Featured').map(escapeHtml).join(', ')}
        </div>
        <div>
            <span class="lbl">Links:</span>
            <div class="nfx-links-row">${linksHtml || '<span style="color:#777">Coming soon</span>'}</div>
        </div>`;

    renderMoreLikeThis(p);

    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('show'));
    document.body.style.overflow = 'hidden';
}

function renderMoreLikeThis(p) {
    const cats = new Set((p.categories || []).filter(c => c !== 'Featured'));
    const related = allProjects.filter(q =>
        q.id !== p.id && (q.categories || []).some(c => cats.has(c))
    ).slice(0, 9);

    const grid = document.getElementById('modalMore');
    if (!related.length) {
        document.querySelector('.nfx-modal-more').style.display = 'none';
        return;
    }
    document.querySelector('.nfx-modal-more').style.display = '';
    grid.innerHTML = related.map(q => {
        const hasImg = !!normalizeImagePath(q.image);
        const lbl = hasImg ? '' : `<span class="lbl">${escapeHtml(q.title)}</span>`;
        return `
        <div class="nfx-more-card" data-id="${escapeHtml(q.id)}" role="button" tabindex="0">
            <div class="nfx-more-thumb" style="${bgStyleFor(q, true)}">${lbl}</div>
            <div class="nfx-more-body">
                <span class="m">${q.match || 90}% Match</span>
                <div class="t">${escapeHtml(q.title)}</div>
            </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.nfx-more-card').forEach(c => {
        const go = () => openModal(c.dataset.id);
        c.addEventListener('click', go);
        c.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
    document.querySelector('.nfx-modal-backdrop').scrollTop = 0;
}

// modal close interactions
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalBackdrop').addEventListener('click', e => {
        if (e.target.id === 'modalBackdrop') closeModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !document.getElementById('modalBackdrop').hidden) closeModal();
    });
});
