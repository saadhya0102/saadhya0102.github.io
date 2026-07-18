'use strict';

const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4177;
const MAX_PORT_ATTEMPTS = 10;
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const SOURCE_ROOT = path.resolve(__dirname, '..', '..');
const ROOT = process.env.PROJECT_EDITOR_ROOT
    ? path.resolve(process.env.PROJECT_EDITOR_ROOT)
    : SOURCE_ROOT;
const APP_DIR = path.join(__dirname, 'app');
const DATA_FILE = path.join(ROOT, 'projects.json');
const IMAGE_DIR = path.join(ROOT, 'projects_images');
const BACKUP_DIR = path.join(ROOT, '.project-editor-backups');

const STATIC_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
};

function setBaseHeaders(response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    );
}

function sendJson(response, status, payload) {
    setBaseHeaders(response);
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(payload));
}

function sendText(response, status, text) {
    setBaseHeaders(response);
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(text);
}

function makeHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function isLocalHostHeader(host) {
    return /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host || '');
}

function isAllowedMutationOrigin(request) {
    const origin = request.headers.origin;
    if (!origin) return true;
    return origin === `http://${request.headers.host}`;
}

async function readBody(request, limit) {
    const declaredLength = Number(request.headers['content-length'] || 0);
    if (declaredLength > limit) {
        throw makeHttpError(413, `Request is larger than ${Math.round(limit / 1024 / 1024)} MB.`);
    }

    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        let settled = false;

        request.on('data', chunk => {
            if (settled) return;
            total += chunk.length;
            if (total > limit) {
                settled = true;
                request.resume();
                reject(makeHttpError(413, `Request is larger than ${Math.round(limit / 1024 / 1024)} MB.`));
                return;
            }
            chunks.push(chunk);
        });

        request.on('end', () => {
            if (!settled) resolve(Buffer.concat(chunks));
        });

        request.on('error', error => {
            if (!settled) reject(error);
        });
    });
}

async function readJsonBody(request) {
    const body = await readBody(request, MAX_JSON_BYTES);
    try {
        return JSON.parse(body.toString('utf8'));
    } catch {
        throw makeHttpError(400, 'Request body is not valid JSON.');
    }
}

function isHttpUrl(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function validateProjectData(data) {
    const errors = [];
    const add = (field, message, projectId = '') => errors.push({ field, message, projectId });

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        add('root', 'The project file must contain a JSON object.');
        return errors;
    }

    if (!Array.isArray(data.categoryOrder)) {
        add('categoryOrder', 'Categories must be an array.');
    }

    if (!Array.isArray(data.projects)) {
        add('projects', 'Projects must be an array.');
        return errors;
    }

    const categories = Array.isArray(data.categoryOrder)
        ? data.categoryOrder.map(value => typeof value === 'string' ? value.trim() : value)
        : [];
    const categorySet = new Set();

    categories.forEach((category, index) => {
        if (typeof category !== 'string' || !category) {
            add(`categoryOrder.${index}`, 'Category names cannot be empty.');
            return;
        }
        if (categorySet.has(category)) {
            add(`categoryOrder.${index}`, `Category "${category}" is listed more than once.`);
        }
        categorySet.add(category);
    });

    if (!categorySet.has('Featured')) {
        add('categoryOrder', 'The Featured category is required.');
    }

    const ids = new Set();
    let featuredCount = 0;

    data.projects.forEach((project, index) => {
        const prefix = `projects.${index}`;
        const projectId = typeof project?.id === 'string' ? project.id : '';

        if (!project || typeof project !== 'object' || Array.isArray(project)) {
            add(prefix, 'Each project must be an object.');
            return;
        }

        if (!projectId) {
            add(`${prefix}.id`, 'Please enter an ID.', projectId);
        } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectId)) {
            add(`${prefix}.id`, 'IDs can contain lowercase letters, numbers, and single hyphens.', projectId);
        } else if (ids.has(projectId)) {
            add(`${prefix}.id`, `The ID "${projectId}" is already in use.`, projectId);
        }
        ids.add(projectId);

        if (typeof project.title !== 'string' || !project.title.trim()) {
            add(`${prefix}.title`, 'Please enter a project title.', projectId);
        }

        if (typeof project.image !== 'string') {
            add(`${prefix}.image`, 'Image must be a filename or URL.', projectId);
        } else if (!isHttpUrl(project.image) && (project.image.includes('..') || project.image.includes('\\'))) {
            add(`${prefix}.image`, 'Local images must be filenames inside projects_images.', projectId);
        }

        if (!Number.isInteger(project.year) || project.year < 1900 || project.year > 2100) {
            add(`${prefix}.year`, 'Year must be a whole number from 1900 through 2100.', projectId);
        }

        if (!Number.isInteger(project.match) || project.match < 0 || project.match > 100) {
            add(`${prefix}.match`, 'Match must be a whole number from 0 through 100.', projectId);
        }

        if (!Array.isArray(project.categories) || project.categories.length === 0) {
            add(`${prefix}.categories`, 'Select at least one category.', projectId);
        } else {
            const seen = new Set();
            project.categories.forEach((category, categoryIndex) => {
                if (typeof category !== 'string' || !category.trim()) {
                    add(`${prefix}.categories.${categoryIndex}`, 'Category names cannot be empty.', projectId);
                } else if (!categorySet.has(category)) {
                    add(`${prefix}.categories.${categoryIndex}`, `Category "${category}" is not in categoryOrder.`, projectId);
                } else if (seen.has(category)) {
                    add(`${prefix}.categories.${categoryIndex}`, `Category "${category}" is selected more than once.`, projectId);
                }
                seen.add(category);
            });
        }

        if (!Array.isArray(project.tags)) {
            add(`${prefix}.tags`, 'Tags must be an array.', projectId);
        } else {
            const seenTags = new Set();
            project.tags.forEach((tag, tagIndex) => {
                const cleanTag = typeof tag === 'string' ? tag.trim() : '';
                if (!cleanTag) {
                    add(`${prefix}.tags.${tagIndex}`, 'Tags cannot be empty.', projectId);
                } else if (seenTags.has(cleanTag.toLowerCase())) {
                    add(`${prefix}.tags.${tagIndex}`, `Tag "${cleanTag}" is listed more than once.`, projectId);
                }
                seenTags.add(cleanTag.toLowerCase());
            });
        }

        if (typeof project.featured !== 'boolean') {
            add(`${prefix}.featured`, 'Featured must be true or false.', projectId);
        } else {
            if (project.featured) featuredCount += 1;
            const hasFeaturedCategory = Array.isArray(project.categories) && project.categories.includes('Featured');
            if (project.featured !== hasFeaturedCategory) {
                add(`${prefix}.featured`, 'Featured status and the Featured category must match.', projectId);
            }
        }

        if (typeof project.synopsis !== 'string' || !project.synopsis.trim()) {
            add(`${prefix}.synopsis`, 'Please enter a synopsis.', projectId);
        }

        if (!Array.isArray(project.links)) {
            add(`${prefix}.links`, 'Links must be an array.', projectId);
        } else {
            project.links.forEach((link, linkIndex) => {
                if (!link || typeof link !== 'object' || Array.isArray(link)) {
                    add(`${prefix}.links.${linkIndex}`, 'Each link needs a label and URL.', projectId);
                    return;
                }
                if (typeof link.label !== 'string' || !link.label.trim()) {
                    add(`${prefix}.links.${linkIndex}.label`, 'Please enter a link label.', projectId);
                }
                if (typeof link.url !== 'string' || !isHttpUrl(link.url)) {
                    add(`${prefix}.links.${linkIndex}.url`, 'Link URLs must start with http:// or https://.', projectId);
                }
            });
        }
    });

    if (data.projects.length > 0 && featuredCount !== 1) {
        add('projects', 'Select exactly one featured project.');
    }

    return errors;
}

async function listImages() {
    await fs.mkdir(IMAGE_DIR, { recursive: true });
    const entries = await fs.readdir(IMAGE_DIR, { withFileTypes: true });
    return entries
        .filter(entry => entry.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(entry.name))
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b));
}

function detectImageType(buffer) {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { extension: '.png', contentType: 'image/png' };
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { extension: '.jpg', contentType: 'image/jpeg' };
    }
    if (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
        return { extension: '.webp', contentType: 'image/webp' };
    }
    if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) {
        return { extension: '.gif', contentType: 'image/gif' };
    }
    return null;
}

function sanitizeImageBase(filename) {
    const parsed = path.parse(path.basename(filename || 'project-image'));
    const normalized = parsed.name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'project-image';
}

async function uniqueImageName(base, extension) {
    const existing = new Set((await listImages()).map(name => name.toLowerCase()));
    let candidate = `${base}${extension}`;
    let suffix = 2;
    while (existing.has(candidate.toLowerCase())) {
        candidate = `${base}-${suffix}${extension}`;
        suffix += 1;
    }
    return candidate;
}

async function createBackup(previousText) {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `projects-${timestamp}.json`;
    await fs.writeFile(path.join(BACKUP_DIR, backupName), previousText, 'utf8');

    const backups = (await fs.readdir(BACKUP_DIR))
        .filter(name => /^projects-.*\.json$/.test(name))
        .sort()
        .reverse();
    await Promise.all(
        backups.slice(30).map(name => fs.unlink(path.join(BACKUP_DIR, name)).catch(() => {}))
    );
    return backupName;
}

async function atomicWrite(filename, contents) {
    const temporary = `${filename}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(temporary, contents);
    try {
        await fs.rename(temporary, filename);
    } catch (error) {
        await fs.unlink(temporary).catch(() => {});
        throw error;
    }
}

async function handleApi(request, response, url) {
    if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { ok: true });
        return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/state') {
        const text = await fs.readFile(DATA_FILE, 'utf8');
        const data = JSON.parse(text);
        sendJson(response, 200, {
            data,
            images: await listImages(),
            paths: {
                projects: path.relative(ROOT, DATA_FILE).replace(/\\/g, '/'),
                images: path.relative(ROOT, IMAGE_DIR).replace(/\\/g, '/')
            }
        });
        return true;
    }

    if (request.method === 'PUT' && url.pathname === '/api/projects') {
        const data = await readJsonBody(request);
        const errors = validateProjectData(data);
        if (errors.length > 0) {
            sendJson(response, 422, { ok: false, errors });
            return true;
        }

        const nextText = `${JSON.stringify(data, null, 2)}\n`;
        const previousText = await fs.readFile(DATA_FILE, 'utf8');
        if (nextText === previousText) {
            sendJson(response, 200, { ok: true, changed: false, backup: null });
            return true;
        }

        const backup = await createBackup(previousText);
        await atomicWrite(DATA_FILE, nextText);
        sendJson(response, 200, { ok: true, changed: true, backup });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/images') {
        const requestedName = url.searchParams.get('filename') || request.headers['x-file-name'] || 'project-image';
        const body = await readBody(request, MAX_IMAGE_BYTES);
        const detected = detectImageType(body);
        if (!detected) {
            throw makeHttpError(415, 'Choose a PNG, JPEG, WebP, or GIF image.');
        }

        const filename = await uniqueImageName(sanitizeImageBase(requestedName), detected.extension);
        await fs.mkdir(IMAGE_DIR, { recursive: true });
        await atomicWrite(path.join(IMAGE_DIR, filename), body);
        sendJson(response, 201, {
            ok: true,
            filename,
            contentType: detected.contentType
        });
        return true;
    }

    return false;
}

async function serveFile(response, filename) {
    const contents = await fs.readFile(filename);
    const type = STATIC_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
    setBaseHeaders(response);
    response.writeHead(200, { 'Content-Type': type });
    response.end(contents);
}

async function handleRequest(request, response) {
    try {
        if (!isLocalHostHeader(request.headers.host)) {
            sendText(response, 403, 'The project editor only accepts local requests.');
            return;
        }
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !isAllowedMutationOrigin(request)) {
            sendText(response, 403, 'Request origin is not allowed.');
            return;
        }

        const url = new URL(request.url, `http://${HOST}`);
        if (url.pathname.startsWith('/api/')) {
            if (!await handleApi(request, response, url)) {
                sendJson(response, 404, { ok: false, message: 'API route not found.' });
            }
            return;
        }

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            sendText(response, 405, 'Method not allowed.');
            return;
        }

        if (url.pathname.startsWith('/images/')) {
            const requested = decodeURIComponent(url.pathname.slice('/images/'.length));
            const filename = path.basename(requested);
            if (!filename || filename !== requested || !/\.(png|jpe?g|webp|gif)$/i.test(filename)) {
                sendText(response, 404, 'Image not found.');
                return;
            }
            await serveFile(response, path.join(IMAGE_DIR, filename));
            return;
        }

        if (url.pathname === '/favicon.svg') {
            await serveFile(response, path.join(SOURCE_ROOT, 'favicon.svg'));
            return;
        }

        const appFiles = {
            '/': 'index.html',
            '/index.html': 'index.html',
            '/styles.css': 'styles.css',
            '/app.js': 'app.js'
        };
        const appFile = appFiles[url.pathname];
        if (!appFile) {
            sendText(response, 404, 'Page not found.');
            return;
        }
        await serveFile(response, path.join(APP_DIR, appFile));
    } catch (error) {
        if (error.code === 'ENOENT') {
            sendText(response, 404, 'File not found.');
            return;
        }
        console.error(error);
        sendJson(response, error.status || 500, {
            ok: false,
            message: error.status ? error.message : 'The editor server could not complete that request.'
        });
    }
}

function openBrowser(url) {
    if (process.argv.includes('--no-open')) return;

    let command;
    let args;
    if (process.platform === 'win32') {
        command = 'cmd';
        args = ['/c', 'start', '', url];
    } else if (process.platform === 'darwin') {
        command = 'open';
        args = [url];
    } else {
        command = 'xdg-open';
        args = [url];
    }

    const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
    });
    child.unref();
}

function requestedPort() {
    const argument = process.argv.find(value => value.startsWith('--port='));
    const parsed = argument ? Number(argument.slice('--port='.length)) : DEFAULT_PORT;
    return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_PORT;
}

function startServer(port, attempt = 0) {
    const server = http.createServer((request, response) => {
        handleRequest(request, response);
    });

    server.once('error', error => {
        if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
            startServer(port + 1, attempt + 1);
            return;
        }
        console.error(`Could not start the project editor: ${error.message}`);
        process.exitCode = 1;
    });

    server.listen(port, HOST, () => {
        const url = `http://${HOST}:${port}`;
        console.log('');
        console.log('Project editor is running.');
        console.log(`Open: ${url}`);
        console.log('Close this window or press Ctrl+C to stop it.');
        console.log('');
        openBrowser(url);
    });

    const stop = () => server.close(() => process.exit(0));
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
}

startServer(requestedPort());
