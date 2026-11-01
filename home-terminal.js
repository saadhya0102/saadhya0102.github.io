import { SiteShell } from './site-shell.mjs';

const form = document.getElementById('terminal-form');
const input = document.getElementById('terminal-input');
const output = document.getElementById('terminal-output');
const cwd = document.getElementById('terminal-cwd');
const history = [];
let historyIndex = 0;
let draft = '';
let running = false;
let completion = null;
let completionRequest = 0;

async function updateCompletion() {
    const request = ++completionRequest;
    const value = input.value;
    completion = null;
    const completed = await shell.complete(value);
    if (request === completionRequest && input.value === value) completion = completed;
}

async function load(folder) {
    const file = { books: 'books.json', projects: 'projects.json', 'problem-setting': 'problems.json', resume: 'resume.html' }[folder];
    const response = await fetch(file);
    if (!response.ok) throw new Error('Load failed');
    if (folder !== 'resume') return response.json();
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    return [...doc.querySelectorAll('.cv-section')].map(section => {
        const title = section.querySelector('.cv-titlebar span')?.textContent || section.id;
        const body = section.querySelector('.cv-body').cloneNode(true);
        body.querySelectorAll('h2').forEach(heading => heading.remove());
        const content = body.textContent.replace(/\s+/g, ' ').trim();
        return { slug: section.id, title, summary: content, content, details: title, href: `resume.html#${section.id}` };
    });
}

const shell = new SiteShell(load);

function safeLink(value) {
    try {
        const url = new URL(value, location.href);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
}

function appendResult(command, prompt, result) {
    if (result.clear) { output.replaceChildren(); return; }
    const block = document.createElement('div');
    block.className = 'explorer-result';
    const echo = document.createElement('p');
    echo.className = 'explorer-echo';
    echo.textContent = `${prompt}$ ${command}`;
    block.append(echo);
    for (const line of result.lines) {
        const row = document.createElement('p');
        const href = line.href && safeLink(line.href);
        if (href) {
            const link = document.createElement('a');
            link.href = href;
            link.textContent = line.text;
            row.append(link);
        } else row.textContent = line.text;
        if (result.error) row.className = 'explorer-error';
        block.append(row);
    }
    output.append(block);
    while (output.childElementCount > 30) output.firstElementChild.remove();
    output.scrollTop = output.scrollHeight;
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    const command = input.value.trim();
    if (running || !command) return;
    running = true;
    const prompt = shell.prompt;
    input.value = '';
    input.readOnly = true;
    form.setAttribute('aria-busy', 'true');
    if (history.at(-1) !== command) history.push(command);
    if (history.length > 100) history.shift();
    historyIndex = history.length;
    draft = '';
    try {
        const result = await shell.run(command);
        appendResult(command, prompt, result);
        cwd.textContent = shell.prompt;
        if (result.navigate) {
            const href = safeLink(result.navigate);
            if (href) location.assign(href);
        }
    } finally {
        running = false;
        input.readOnly = false;
        form.removeAttribute('aria-busy');
        input.focus({ preventScroll: true });
        updateCompletion();
    }
});

input.addEventListener('keydown', event => {
    if (running || event.isComposing) return;
    if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        output.replaceChildren();
    } else if (['ArrowUp', 'ArrowDown'].includes(event.key) && history.length) {
        event.preventDefault();
        if (historyIndex === history.length) draft = input.value;
        historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
        input.value = historyIndex === history.length ? draft : history[historyIndex];
        input.setSelectionRange(input.value.length, input.value.length);
        updateCompletion();
    } else if (event.key === 'Tab' && !event.shiftKey && completion && completion !== input.value && input.selectionStart === input.value.length) {
        event.preventDefault();
        input.value = completion;
        updateCompletion();
    }
});

document.querySelectorAll('[data-command]').forEach(button => {
    button.addEventListener('click', () => {
        if (running) return;
        input.value = button.dataset.command;
        input.focus({ preventScroll: true });
        input.setSelectionRange(input.value.length, input.value.length);
        updateCompletion();
    });
});
input.addEventListener('input', updateCompletion);
input.addEventListener('focus', updateCompletion);
