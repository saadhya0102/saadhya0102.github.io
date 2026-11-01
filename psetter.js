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

const difficultyGroups = [
    ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['very-hard', 'Very hard']
];

function problemDifficulty(problem) {
    return difficultyGroups.some(([key]) => key === problem.difficulty) ? problem.difficulty : 'medium';
}

function renderProblems(problems, list, searching = false) {
    list.replaceChildren();
    for (const [key, label] of difficultyGroups) {
        const items = problems.filter(p => problemDifficulty(p) === key);
        if (searching && !items.length) continue;
        const group = document.createElement('section');
        group.className = 'problem-group';
        group.setAttribute('aria-labelledby', `difficulty-${key}`);
        const groupHeading = document.createElement('h2');
        groupHeading.id = `difficulty-${key}`;
        groupHeading.className = 'problem-group-title';
        groupHeading.textContent = label;
        group.append(groupHeading);
        if (!items.length) {
            const empty = document.createElement('p');
            empty.className = 'problem-group-empty';
            empty.textContent = 'No public problems listed yet.';
            group.append(empty);
        }
        for (const p of items) {
            const article = document.createElement('article');
            article.className = 'problem';
            const heading = document.createElement('h3');
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
            group.append(article);
        }
        list.append(group);
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
            const matches = problems.filter(p => [p.title, p.platform, p.contest, p.tags, p.notes, problemDifficulty(p).replace('-', ' ')].join(' ').toLowerCase().includes(query));
            renderProblems(matches, list, !!query);
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
