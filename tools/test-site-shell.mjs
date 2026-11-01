import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SiteShell, tokenize } from '../site-shell.mjs';

const catalogs = Object.fromEntries(await Promise.all([
    ['books', '../books.json'], ['projects', '../projects.json'], ['problem-setting', '../problems.json']
].map(async ([key, file]) => [key, JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'))])));
const makeShell = () => new SiteShell(async folder => folder === 'resume'
    ? [{ slug: 'education', title: 'Education', content: 'UT Austin', href: 'resume.html#education' }]
    : structuredClone(catalogs[folder]));
const lines = result => result.lines.map(line => line.text).join('\n');

test('browse folders without navigating, then open real entry routes', async () => {
    const shell = makeShell();
    assert.equal((await shell.run('ls')).lines.filter(line => line.href).length, 4);
    assert.equal((await shell.run('cd books')).navigate, undefined);
    assert.equal(shell.prompt, '~/books');
    const listing = await shell.run('ls');
    assert.equal(listing.lines.filter(line => line.href).length, 5);
    assert.match(lines(listing), /Next: ls --page 2/);
    assert.match(lines(await shell.run('cat mother-of-learning')), /Zorian/);
    assert.equal((await shell.run('open "Mother of Learning"')).navigate, 'books.html#book-1');
    assert.equal((await shell.run('jump /projects/crux')).navigate, 'projects.html#project-crux');
    await shell.run('cd ../resume');
    assert.equal((await shell.run('open education')).navigate, 'resume.html#education');
    await shell.run('cd ~');
    assert.equal(shell.prompt, '~');
});

test('filters, sort, and pagination operate on real catalogs', async () => {
    const shell = makeShell();
    const top = await shell.run('ls /books --top -l -n 3');
    const expected = [...catalogs.books].sort((a, b) => b.overallRating - a.overallRating).slice(0, 3);
    assert.deepEqual(top.lines.filter(line => line.href).map(line => line.href), expected.map(b => `books.html#book-${b.id}`));
    const first = await shell.run('ls /books --tag "time loop" -n 1');
    const second = await shell.run('ls /books --tag "time loop" -n 1 --page 2');
    assert.notEqual(first.lines[0].href, second.lines[0].href);
    assert.match(lines(first), /Next: ls \/books --tag "time loop" -n 1 --page 2/);
    const games = await shell.run('ls /projects --category games -n 20');
    assert.ok(games.lines.some(line => line.href === 'projects.html#project-tetherfall'));
    const problems = await shell.run('ls /problem-setting --difficulty medium');
    assert.equal(problems.lines.filter(line => line.href).length, 2);
    assert.equal((await shell.run('open /psetter/chippa-rank')).navigate, 'https://codeforces.com/gym/106420/problem/F');
});

test('invalid input preserves the current folder and gives useful errors', async () => {
    const shell = makeShell();
    await shell.run('cd /books');
    for (const command of ['ls -n 0', 'ls -n 21', 'ls --page 0', 'ls --surprise', 'ls --tag', 'ls --difficulty medium', 'cd /missing', 'cd mother-of-learning', 'cat "unfinished']) {
        assert.equal((await shell.run(command)).error, true, command);
        assert.equal(shell.prompt, '~/books');
    }
    assert.match(lines(await shell.run('ls --tag nonexistent')), /No entries match/);
    assert.match(lines(await shell.run('ls --page 999999')), /No entries on page/);
    assert.equal((await shell.run('open https://example.com')).navigate, undefined);
    assert.equal((await shell.run('rm -rf /')).error, true);
    assert.equal((await shell.run('clear')).clear, true);
});

test('navigation aliases, relative paths, and unique completion agree', async () => {
    const shell = makeShell();
    await shell.run('cd /PSETTER');
    assert.equal(shell.prompt, '~/problem-setting');
    await shell.run('cd ../../projects');
    assert.equal(shell.prompt, '~/projects');
    assert.equal(await shell.complete('open cru'), 'open crux');
    assert.equal(await shell.complete('he'), 'help ');
    assert.equal(await shell.complete('cd /boo'), 'cd /books/');
    assert.equal(await shell.complete('cd cru'), null);
    assert.equal(await shell.complete('open /missing/name'), null);
    assert.deepEqual(tokenize('ls --tag "time loop"'), ['ls', '--tag', 'time loop']);
});

test('help stays available and failed catalog loads can be retried', async () => {
    let attempts = 0;
    const shell = new SiteShell(async () => { if (++attempts === 1) throw new Error('offline'); return catalogs.books; });
    assert.match(lines(await shell.run('help')), /open/);
    assert.equal(attempts, 0);
    assert.equal((await shell.run('ls /books')).error, true);
    assert.equal((await shell.run('ls /books')).error, undefined);
    assert.equal(attempts, 2);
    assert.match(lines(await shell.run('tree')), /projects\//);
});
