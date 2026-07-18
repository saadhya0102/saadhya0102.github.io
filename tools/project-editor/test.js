'use strict';

const assert = require('assert/strict');
const fs = require('fs/promises');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

async function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(error => error ? reject(error) : resolve(port));
        });
    });
}

async function waitForServer(url, child) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        if (child.exitCode != null) {
            throw new Error(`Editor server exited with code ${child.exitCode}.`);
        }
        try {
            const response = await fetch(`${url}/api/health`);
            if (response.ok) return;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw new Error('Editor server did not start within 10 seconds.');
}

async function statusWithHost(port, host) {
    return new Promise((resolve, reject) => {
        const request = http.request({
            hostname: '127.0.0.1',
            port,
            path: '/api/health',
            headers: { Host: host }
        }, response => {
            response.resume();
            response.once('end', () => resolve(response.statusCode));
        });
        request.once('error', reject);
        request.end();
    });
}

async function run() {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'project-editor-'));
    const port = await freePort();
    const url = `http://127.0.0.1:${port}`;
    let child;

    try {
        await fs.copyFile(path.join(ROOT, 'projects.json'), path.join(fixtureRoot, 'projects.json'));
        await fs.mkdir(path.join(fixtureRoot, 'projects_images'));

        child = spawn(
            process.execPath,
            [path.join(__dirname, 'server.js'), '--no-open', `--port=${port}`],
            {
                cwd: ROOT,
                env: { ...process.env, PROJECT_EDITOR_ROOT: fixtureRoot },
                stdio: ['ignore', 'pipe', 'pipe']
            }
        );

        await waitForServer(url, child);
        assert.equal(await statusWithHost(port, 'example.com'), 403);

        const stateResponse = await fetch(`${url}/api/state`);
        assert.equal(stateResponse.status, 200);
        const editorState = await stateResponse.json();
        assert.equal(editorState.data.projects.length, 9);

        const invalid = deepClone(editorState.data);
        invalid.projects[0].id = invalid.projects[1].id;
        const invalidResponse = await fetch(`${url}/api/projects`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invalid)
        });
        assert.equal(invalidResponse.status, 422);

        const changed = deepClone(editorState.data);
        changed.projects[0].title = `${changed.projects[0].title} test`;
        const saveResponse = await fetch(`${url}/api/projects`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(changed)
        });
        assert.equal(saveResponse.status, 200);
        const saveResult = await saveResponse.json();
        assert.equal(saveResult.changed, true);
        assert.ok(saveResult.backup);

        const savedFile = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'projects.json'), 'utf8'));
        assert.equal(savedFile.projects[0].title, changed.projects[0].title);
        const backups = await fs.readdir(path.join(fixtureRoot, '.project-editor-backups'));
        assert.equal(backups.length, 1);

        const png = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            'base64'
        );
        const blockedOriginResponse = await fetch(`${url}/api/images?filename=blocked.png`, {
            method: 'POST',
            headers: {
                'Content-Type': 'image/png',
                Origin: 'https://example.com'
            },
            body: png
        });
        assert.equal(blockedOriginResponse.status, 403);

        const imageResponse = await fetch(`${url}/api/images?filename=Test%20Image.png`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/png' },
            body: png
        });
        assert.equal(imageResponse.status, 201);
        const imageResult = await imageResponse.json();
        assert.equal(imageResult.filename, 'test-image.png');
        await fs.access(path.join(fixtureRoot, 'projects_images', imageResult.filename));

        const invalidImageResponse = await fetch(`${url}/api/images?filename=bad.png`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/png' },
            body: Buffer.from('not an image')
        });
        assert.equal(invalidImageResponse.status, 415);

        const traversalResponse = await fetch(`${url}/images/%2e%2e%2fprojects.json`);
        assert.equal(traversalResponse.status, 404);

        console.log('Project editor API tests passed.');
    } finally {
        if (child && child.exitCode == null) {
            child.kill();
            await new Promise(resolve => child.once('exit', resolve));
        }
        await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
