'use strict';

const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4197;
const MAX_PORT_ATTEMPTS = 10;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const SOURCE_ROOT = path.resolve(__dirname, '..', '..');
const ROOT = process.env.BOOK_EDITOR_ROOT
    ? path.resolve(process.env.BOOK_EDITOR_ROOT)
    : SOURCE_ROOT;
const APP_DIR = path.join(__dirname, 'app');
const SHARED_STYLES = path.join(SOURCE_ROOT, 'tools', 'project-editor', 'app', 'styles.css');
const DATA_FILE = path.join(ROOT, 'books.json');
const IMAGE_DIR = path.join(ROOT, 'books_images');
const BACKUP_DIR = path.join(ROOT, '.book-editor-backups');

const STATIC_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
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

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateBooks(books) {
    const errors = [];
    const add = (field, message, bookId = '') => errors.push({ field, message, bookId });

    if (!Array.isArray(books)) {
        add('root', 'books.json must contain an array.');
        return errors;
    }

    const ids = new Set();
    books.forEach((book, index) => {
        const prefix = `books.${index}`;
        const bookId = typeof book?.id === 'string' ? book.id : '';

        if (!book || typeof book !== 'object' || Array.isArray(book)) {
            add(prefix, 'Each book must be an object.');
            return;
        }

        if (!bookId) {
            add(`${prefix}.id`, 'Please enter an ID.', bookId);
        } else if (!/^\d+$/.test(bookId)) {
            add(`${prefix}.id`, 'Book IDs must contain numbers only.', bookId);
        } else if (ids.has(bookId)) {
            add(`${prefix}.id`, `The ID "${bookId}" is already in use.`, bookId);
        }
        ids.add(bookId);

        if (typeof book.title !== 'string' || !book.title.trim()) {
            add(`${prefix}.title`, 'Please enter a title.', bookId);
        }

        if (typeof book.author !== 'string' || !book.author.trim()) {
            add(`${prefix}.author`, 'Please enter an author.', bookId);
        }

        if (typeof book.image !== 'string') {
            add(`${prefix}.image`, 'Image must be a filename or URL.', bookId);
        } else if (!/^https?:\/\//i.test(book.image) && (book.image.includes('..') || book.image.includes('\\'))) {
            add(`${prefix}.image`, 'Local covers must be filenames inside books_images.', bookId);
        }

        if (typeof book.overallRating !== 'number' || !Number.isFinite(book.overallRating) || book.overallRating < 0 || book.overallRating > 10) {
            add(`${prefix}.overallRating`, 'Rating must be a number from 0 through 10.', bookId);
        }

        if (!Number.isInteger(book.numberOfWords) || book.numberOfWords < 0) {
            add(`${prefix}.numberOfWords`, 'Word count must be a whole number of 0 or more.', bookId);
        }

        if (book.dateRead != null && book.dateRead !== '' && (typeof book.dateRead !== 'string' || !validDate(book.dateRead))) {
            add(`${prefix}.dateRead`, 'Date read must use YYYY-MM-DD.', bookId);
        }

        if (!Array.isArray(book.tags)) {
            add(`${prefix}.tags`, 'Tags must be an array.', bookId);
        } else {
            const seen = new Set();
            book.tags.forEach((tag, tagIndex) => {
                const clean = typeof tag === 'string' ? tag.trim() : '';
                if (!clean) {
                    add(`${prefix}.tags.${tagIndex}`, 'Tags cannot be empty.', bookId);
                } else if (seen.has(clean.toLowerCase())) {
                    add(`${prefix}.tags.${tagIndex}`, `Tag "${clean}" is listed more than once.`, bookId);
                }
                seen.add(clean.toLowerCase());
            });
        }

        if (typeof book.synopsis !== 'string') {
            add(`${prefix}.synopsis`, 'Synopsis must be text.', bookId);
        }
        if (typeof book.review !== 'string') {
            add(`${prefix}.review`, 'Review must be text.', bookId);
        }
    });

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
    const parsed = path.parse(path.basename(filename || 'book-cover'));
    const normalized = parsed.name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'book-cover';
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
    const backupName = `books-${timestamp}.json`;
    await fs.writeFile(path.join(BACKUP_DIR, backupName), previousText, 'utf8');

    const backups = (await fs.readdir(BACKUP_DIR))
        .filter(name => /^books-.*\.json$/.test(name))
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
                books: path.relative(ROOT, DATA_FILE).replace(/\\/g, '/'),
                images: path.relative(ROOT, IMAGE_DIR).replace(/\\/g, '/')
            }
        });
        return true;
    }

    if (request.method === 'PUT' && url.pathname === '/api/books') {
        const books = await readJsonBody(request);
        const errors = validateBooks(books);
        if (errors.length > 0) {
            sendJson(response, 422, { ok: false, errors });
            return true;
        }

        const nextText = `${JSON.stringify(books, null, 2)}\n`;
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
        const requestedName = url.searchParams.get('filename') || request.headers['x-file-name'] || 'book-cover';
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
            sendText(response, 403, 'The book editor only accepts local requests.');
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
                sendText(response, 404, 'Cover not found.');
                return;
            }
            await serveFile(response, path.join(IMAGE_DIR, filename));
            return;
        }

        if (url.pathname === '/favicon.svg') {
            await serveFile(response, path.join(SOURCE_ROOT, 'favicon.svg'));
            return;
        }

        if (url.pathname === '/styles.css') {
            await serveFile(response, SHARED_STYLES);
            return;
        }

        const appFiles = {
            '/': 'index.html',
            '/index.html': 'index.html',
            '/book-styles.css': 'book-styles.css',
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
            message: error.status ? error.message : 'The book editor server could not complete that request.'
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
        console.error(`Could not start the book editor: ${error.message}`);
        process.exitCode = 1;
    });

    server.listen(port, HOST, () => {
        const url = `http://${HOST}:${port}`;
        console.log('');
        console.log('Book editor is running.');
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
