function problemLink(url, label) {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        const a = document.createElement('a');
        a.href = parsed.href;
        a.textContent = label;
        return a;
    } catch { return null; }
}

function renderProblems(problems, list) {
    list.replaceChildren();
    for (const p of problems) {
        const article = document.createElement('article');
        article.className = 'problem';
        const heading = document.createElement('h2');
        heading.textContent = p.title;
        const meta = document.createElement('p');
        meta.className = 'problem-meta';
        meta.textContent = [p.platform, p.contest, p.date, p.tags].filter(Boolean).join(' · ');
        article.append(heading, meta);
        if (p.notes) {
            const notes = document.createElement('p');
            notes.textContent = p.notes;
            article.append(notes);
        }
        const links = document.createElement('div');
        links.className = 'inline-links';
        const statement = problemLink(p.url, 'Problem statement ↗');
        const editorial = problemLink(p.editorial, 'Editorial ↗');
        if (statement) links.append(statement);
        if (editorial) links.append(editorial);
        article.append(links);
        list.append(article);
    }
}

async function loadProblems() {
    const list = document.getElementById('problem-list');
    try {
        const response = await fetch('problems.json');
        if (!response.ok) throw new Error('Could not load problems');
        const data = await response.json();
        if (!Array.isArray(data.problems)) throw new Error('Invalid problem data');
        const problems = data.problems;
        if (!problems.length) {
            list.innerHTML = '<div class="empty-state"><h2>Problems coming soon.</h2><p>I’ll be adding my past contest problems here.</p></div>';
            return;
        }
        document.getElementById('problem-tools').hidden = false;
        const search = document.getElementById('problem-search');
        function update() {
            const query = search.value.trim().toLowerCase();
            const matches = problems.filter(p => [p.title, p.platform, p.contest, p.tags, p.notes].join(' ').toLowerCase().includes(query));
            renderProblems(matches, list);
            document.getElementById('problem-count').textContent = `${matches.length} ${matches.length === 1 ? 'problem' : 'problems'}`;
            if (!matches.length) list.textContent = 'No problems match your search.';
        }
        search.addEventListener('input', update);
        update();
    } catch {
        list.textContent = 'Problems could not be loaded. Please refresh to try again.';
    }
}
loadProblems();
