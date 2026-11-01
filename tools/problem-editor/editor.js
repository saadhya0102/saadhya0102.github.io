const form = document.getElementById('editor');
const entries = document.getElementById('entries');
const status = document.getElementById('status');
const save = document.getElementById('save');
const add = document.getElementById('add');
const fields = [
    ['title', 'Title', 'text', true], ['platform', 'Platform (e.g. Codeforces)', 'text'],
    ['contest', 'Contest / round', 'text'], ['date', 'Date or year', 'text'],
    ['url', 'Problem URL', 'url', true], ['editorial', 'Editorial URL', 'url'],
    ['tags', 'Topics (comma separated)', 'text'], ['notes', 'Notes / your contribution', 'textarea']
];
let dirty = false;
function markDirty() { dirty = true; status.textContent = 'Unsaved changes'; }
function addEntry(data = {}) {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = data.title || 'New problem';
    const grid = document.createElement('div');
    grid.className = 'fields';
    for (const [name, text, type, required] of fields) {
        const label = document.createElement('label');
        label.textContent = text + (required ? ' *' : '');
        const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
        if (type !== 'textarea') input.type = type;
        if (type === 'textarea') label.className = 'wide';
        input.name = name;
        input.value = data[name] || '';
        input.required = !!required;
        input.maxLength = 10000;
        label.append(input);
        grid.append(label);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button';
    remove.textContent = 'Remove problem';
    remove.addEventListener('click', () => { fieldset.remove(); markDirty(); });
    fieldset.append(legend, grid, remove);
    entries.append(fieldset);
    return fieldset;
}
add.disabled = save.disabled = true;
fetch('/api/problems').then(r => { if (!r.ok) throw new Error('Unable to load problems'); return r.json(); }).then(data => {
    if (!Array.isArray(data.problems)) throw new Error('Invalid problems file');
    data.problems.forEach(addEntry);
    status.textContent = data.problems.length ? 'Ready to edit.' : 'No problems yet. Add your first one above.';
    add.disabled = save.disabled = false;
}).catch(error => { status.textContent = error.message + '. Refresh before editing.'; });
add.addEventListener('click', () => { const entry = addEntry(); markDirty(); entry.querySelector('input').focus(); });
form.addEventListener('input', markDirty);
form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const problems = [...entries.children].map(entry => Object.fromEntries(fields.map(([name]) => [name, entry.querySelector(`[name="${name}"]`).value.trim()])));
    save.disabled = add.disabled = true;
    entries.inert = true;
    status.textContent = 'Saving…';
    try {
        const response = await fetch('/api/problems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problems }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Save failed');
        dirty = false;
        status.textContent = 'Saved to problems.json. Refresh the preview to see your changes.';
    } catch (error) { status.textContent = error.message; }
    finally { save.disabled = add.disabled = false; entries.inert = false; }
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
