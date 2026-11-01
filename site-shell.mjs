const folders = [
    { slug: 'resume', title: 'Resume', summary: 'Experience, education, achievements, and skills.', href: 'resume.html' },
    { slug: 'books', title: 'Books', summary: 'Reading notes, reviews, and ratings.', href: 'books.html' },
    { slug: 'problem-setting', title: 'Problem-Setting', summary: 'Public contest problems, grouped by rough difficulty.', href: 'psetter.html' },
    { slug: 'projects', title: 'Projects', summary: 'Personal projects and source repositories.', href: 'projects.html' }
];
const aliases = { psetter: 'problem-setting', psetting: 'problem-setting', problems: 'problem-setting', book: 'books', project: 'projects' };
const slugify = value => String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const shorten = (value, max = 170) => String(value || '').length > max ? String(value).slice(0, max - 3) + '...' : String(value || '');
const text = value => ({ text: String(value) });
const quote = value => /\s/.test(value) ? JSON.stringify(value) : value;
const help = [
    'Explore: resume/  books/  problem-setting/  projects/',
    'cd books                   Enter a folder. cd .. goes back; cd ~ goes home.',
    'ls                         Show up to 5 entries in the current folder.',
    'ls /books --top -l          Highest-rated books, with details.',
    'ls --tag "time loop"        Filter books or projects by tag/category.',
    'ls /problem-setting --difficulty medium',
    'ls -n 3 --page 2            Change the limit (1-20) or page.',
    'ls --recent                Recent books, or projects by year.',
    'cat mother-of-learning     Read an entry. Use its name from ls.',
    'open mother-of-learning    Jump to that entry. open . opens this folder.',
    'open /projects/crux        Paths work from any folder. jump also works.',
    'tree                       A small map of the site.',
    'pwd                        Show the current path.',
    'clear                      Clear the output.',
    'Up/Down: command history. Tab: complete a unique name. Ctrl+L: clear.'
];

export function tokenize(line) {
    const tokens = [];
    let current = '', quoted = '', started = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '\\' && quoted && [quoted, '\\'].includes(line[i + 1])) {
            current += line[++i];
        } else if (quoted) {
            if (char === quoted) quoted = '';
            else current += char;
        } else if (char === '"' || char === "'") {
            quoted = char; started = true;
        } else if (/\s/.test(char)) {
            if (started) tokens.push(current);
            current = ''; started = false;
        } else {
            current += char; started = true;
        }
    }
    if (quoted) throw new Error('Close the quoted text and try again.');
    if (started) tokens.push(current);
    return tokens;
}

export class SiteShell {
    constructor(load) { this.load = load; this.cwd = []; this.cache = new Map(); }
    get prompt() { return '~' + (this.cwd.length ? '/' + this.cwd.join('/') : ''); }

    resolve(value = '.') {
        const absolute = value.startsWith('/') || value.startsWith('~');
        const path = absolute ? [] : [...this.cwd];
        for (const part of value.replace(/^~\/?/, '').split('/')) {
            if (!part || part === '.') continue;
            if (part === '..') path.pop();
            else {
                const name = slugify(part);
                path.push(path.length === 0 ? aliases[name] || name : name);
            }
        }
        return path;
    }

    async entries(folder) {
        if (!folder) return folders.map(f => ({ ...f, directory: true }));
        if (!folders.some(f => f.slug === folder)) throw new Error(`No folder named ${folder}. Try ls /.`);
        if (this.cache.has(folder)) return this.cache.get(folder);
        let data;
        try { data = await this.load(folder); }
        catch { throw new Error(`Couldn't load ${folder}. Please try again.`); }
        let entries;
        if (folder === 'books') entries = data.map(b => ({
            slug: slugify(b.title), id: String(b.id), title: b.title, summary: b.synopsis || '',
            details: [b.author, Number(b.overallRating) > 0 ? `${b.overallRating}/10` : 'Not rated'].filter(Boolean).join(' | '),
            content: [b.synopsis, b.review && `Review: ${b.review}`].filter(Boolean).join('\n\n'),
            tags: b.tags || [], rating: Number(b.overallRating) || 0, date: Date.parse(b.dateRead) || 0,
            href: `books.html#book-${encodeURIComponent(b.id)}`
        }));
        if (folder === 'projects') entries = data.projects.map(p => ({
            slug: p.id, id: p.id, title: p.title, summary: p.synopsis || '', content: p.synopsis || '',
            details: (p.tags || []).join(', '), tags: [...(p.tags || []), ...(p.categories || [])],
            date: Number(p.year) || 0, href: `projects.html#project-${encodeURIComponent(p.id)}`
        }));
        if (folder === 'problem-setting') entries = data.problems.map(p => ({
            slug: slugify(p.title.replace(/^[A-Z]\.\s*/, '')), title: p.title, summary: p.notes || p.contest,
            content: [p.contest, p.notes].filter(Boolean).join('\n'),
            difficulty: p.difficulty || 'medium', details: `${(p.difficulty || 'medium').replace('-', ' ')} | ${p.contest}`,
            tags: [], href: p.url
        }));
        if (folder === 'resume') entries = data;
        // Keep command names unique even when the catalog contains duplicate titles.
        const counts = new Map();
        entries.forEach(e => counts.set(e.slug, (counts.get(e.slug) || 0) + 1));
        entries.forEach((e, i) => { if (counts.get(e.slug) > 1) e.slug += '-' + (e.id || i + 1); });
        this.cache.set(folder, entries);
        return entries;
    }

    async target(path) {
        if (!path.length) return { title: 'Home', summary: 'Explore resume/, books/, problem-setting/, and projects/.', href: 'index.html', directory: true };
        const folder = folders.find(f => f.slug === path[0]);
        if (!folder) throw new Error(`No folder named ${path[0]}. Try ls /.`);
        if (path.length === 1) return { ...folder, directory: true };
        if (path.length > 2) throw new Error('That path does not exist. Try ls to see available names.');
        const entry = (await this.entries(folder.slug)).find(e => e.slug === path[1] || e.id === path[1] || slugify(e.title) === path[1]);
        if (!entry) throw new Error(`No entry named ${path[1]}. Try ls /${folder.slug}.`);
        return entry;
    }

    async list(args) {
        let path = '.', limit = 5, page = 1, detailed = false, top = false, recent = false, tag = '', difficulty = '';
        let explicitPath = false;
        const valueAfter = (i, flag) => {
            if (!args[i + 1] || args[i + 1].startsWith('-')) throw new Error(`${flag} needs a value. Try help.`);
            return args[i + 1];
        };
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--help') return { lines: help.slice(2, 8).map(text) };
            if (arg === '-l' || arg === '--long') detailed = true;
            else if (arg === '--top') top = true;
            else if (arg === '--recent') recent = true;
            else if (arg === '-n' || arg === '--limit') { limit = Number(valueAfter(i, arg)); i++; }
            else if (arg === '--page') { page = Number(valueAfter(i, arg)); i++; }
            else if (arg === '--tag' || arg === '--category') { tag = valueAfter(i, arg); i++; }
            else if (arg === '--difficulty') { difficulty = slugify(valueAfter(i, arg)); i++; }
            else if (arg.startsWith('-')) throw new Error(`Unknown flag ${arg}. Type help for the available flags.`);
            else if (explicitPath) throw new Error('Use one folder path, with quotes if it contains spaces.');
            else { path = arg; explicitPath = true; }
        }
        if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('Use a listing limit from 1 to 20. Example: ls -n 10');
        if (!Number.isSafeInteger(page) || page < 1) throw new Error('Page must be a positive whole number.');
        const resolved = this.resolve(path);
        const target = await this.target(resolved);
        if (!target.directory) throw new Error('ls needs a folder. Use cat or open for an entry.');
        const folder = resolved[0];
        if (top && folder !== 'books') throw new Error('--top works in books. Try ls /books --top.');
        if (recent && !['books', 'projects'].includes(folder)) throw new Error('--recent works in books or projects.');
        if (top && recent) throw new Error('Choose either --top or --recent.');
        if (tag && !['books', 'projects'].includes(folder)) throw new Error('--tag works in books or projects.');
        if (difficulty && folder !== 'problem-setting') throw new Error('--difficulty works in problem-setting.');
        if (difficulty && !['easy', 'medium', 'hard', 'very-hard'].includes(difficulty)) throw new Error('Choose easy, medium, hard, or very-hard.');
        let entries = [...await this.entries(folder)];
        if (tag) entries = entries.filter(e => e.tags.some(t => t.toLowerCase().includes(tag.toLowerCase())));
        if (difficulty) entries = entries.filter(e => e.difficulty === difficulty);
        if (top) entries.sort((a, b) => b.rating - a.rating);
        if (recent) entries.sort((a, b) => b.date - a.date);
        const start = (page - 1) * limit;
        const visible = entries.slice(start, start + limit);
        if (!visible.length) return { lines: [text(entries.length ? `No entries on page ${page}. Try --page 1.` : 'No entries match this listing.')] };
        const lines = visible.map(e => ({
            text: `${e.slug}${e.directory ? '/' : ''}${detailed ? '  | ' + (e.details || e.summary) : ''}`,
            href: e.href
        }));
        lines.push(text(`Showing ${start + 1}-${start + visible.length} of ${entries.length}.`));
        if (start + limit < entries.length) {
            const next = [...args];
            const pageAt = next.indexOf('--page');
            if (pageAt >= 0) next[pageAt + 1] = String(page + 1);
            else next.push('--page', String(page + 1));
            lines.push(text(`Next: ls ${next.map(quote).join(' ')}`));
        }
        return { lines };
    }

    async run(line) {
        try {
            const [rawCommand, ...args] = tokenize(line.trim());
            if (!rawCommand) return { lines: [] };
            const command = rawCommand.toLowerCase();
            if (command === 'help') return { lines: help.map(text) };
            if (command === 'clear') return { clear: true, lines: [] };
            if (command === 'pwd') return { lines: [text(this.prompt)] };
            if (command === 'ls') return await this.list(args);
            if (command === 'cd') {
                const path = this.resolve(args.join(' ') || '~');
                const target = await this.target(path);
                if (!target.directory) throw new Error('That is an entry, not a folder. Use cat or open.');
                this.cwd = path;
                return { lines: [text(`${this.prompt}  |  ${target.summary}`)] };
            }
            if (['open', 'jump', 'cat'].includes(command)) {
                if (command === 'cat' && !args.length) throw new Error('Usage: cat <name>. Use ls to find a name.');
                const target = await this.target(this.resolve(args.join(' ') || '.'));
                if (command === 'cat') return { lines: [text(target.title), text(shorten(target.content || target.summary, 1400)), { text: 'Open page', href: target.href }] };
                return { lines: [text(`Opening ${target.title}...`)], navigate: target.href };
            }
            if (command === 'tree') {
                const lines = [text('~/')];
                for (const folder of folders) {
                    lines.push({ text: `  ${folder.slug}/`, href: folder.href });
                    try {
                        const entries = await this.entries(folder.slug);
                        lines.push(...entries.slice(0, 3).map(e => text(`    ${e.slug}`)));
                        if (entries.length > 3) lines.push(text(`    ... ${entries.length - 3} more`));
                    } catch { lines.push(text('    unavailable; try again later')); }
                }
                return { lines };
            }
            throw new Error(`Unknown command: ${rawCommand}. Type help to see the commands.`);
        } catch (error) { return { lines: [text(error.message)], error: true }; }
    }

    async complete(line) {
        if (!line.includes(' ')) {
            const matches = ['help', 'cd', 'ls', 'cat', 'open', 'jump', 'tree', 'pwd', 'clear'].filter(c => c.startsWith(line.toLowerCase()));
            return matches.length === 1 ? matches[0] + ' ' : null;
        }
        const prefix = line.slice(0, line.lastIndexOf(' ') + 1);
        const word = line.slice(prefix.length);
        if (word.startsWith('-')) return null;
        const slash = word.lastIndexOf('/');
        const parent = slash >= 0 ? word.slice(0, slash + 1) : '';
        const fragment = word.slice(slash + 1).toLowerCase();
        const path = this.resolve(parent || '.');
        if (path.length > 1) return null;
        try {
            let entries = await this.entries(path[0]);
            if (line.trimStart().startsWith('cd ')) entries = entries.filter(e => e.directory);
            const matches = entries.filter(e => e.slug.startsWith(fragment));
            if (matches.length !== 1) return null;
            return prefix + parent + matches[0].slug + (matches[0].directory ? '/' : '');
        } catch { return null; }
    }
}
