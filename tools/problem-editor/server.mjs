import http from 'node:http';
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const port = 4319;
const origin = `http://127.0.0.1:${port}`;
const dataPath = path.join(root, 'problems.json');
const fields = ['title', 'platform', 'contest', 'date', 'url', 'editorial', 'tags', 'notes'];
function validate(data) {
    if (!data || !Array.isArray(data.problems) || data.problems.length > 1000) throw new Error('Expected a list of up to 1,000 problems.');
    return { problems: data.problems.map((p, i) => {
        if (!p || fields.some(key => typeof p[key] !== 'string' || p[key].length > 10000)) throw new Error(`Check the fields for problem ${i + 1}.`);
        const result = Object.fromEntries(fields.map(key => [key, p[key].trim()]));
        if (!result.title || !result.url) throw new Error(`Problem ${i + 1} needs a title and URL.`);
        for (const key of ['url', 'editorial']) {
            if (result[key] && !['http:', 'https:'].includes(new URL(result[key]).protocol)) throw new Error('Links must use http or https.');
        }
        return result;
    }) };
}
let saving = false;
const server = http.createServer(async (req, res) => {
    const send = (status, body, type = 'application/json') => {
        res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(body);
    };
    if (req.headers.host !== `127.0.0.1:${port}`) return send(403, '{"error":"Invalid host"}');
    try {
        if (req.method === 'POST' && req.url === '/api/problems') {
            if (req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/json')) return send(403, '{"error":"Invalid request origin or content type"}');
            if (saving) return send(409, '{"error":"A save is already in progress. Please try again."}');
            let body = '';
            for await (const chunk of req) {
                body += chunk;
                if (Buffer.byteLength(body) > 2_000_000) return send(413, '{"error":"Data is too large"}');
            }
            const data = validate(JSON.parse(body));
            saving = true;
            try {
                const backupDir = path.join(root, '.problem-editor-backups');
                await mkdir(backupDir, { recursive: true });
                await copyFile(dataPath, path.join(backupDir, `problems-${Date.now()}.json`));
                await writeFile(`${dataPath}.tmp`, JSON.stringify(data, null, 2) + '\n');
                await rename(`${dataPath}.tmp`, dataPath);
                send(200, '{"saved":true}');
            } finally { saving = false; }
            return;
        }
        if (req.method !== 'GET') return send(405, '{"error":"Method not allowed"}');
        const routes = {
            '/': ['tools/problem-editor/index.html', 'text/html'],
            '/editor.js': ['tools/problem-editor/editor.js', 'text/javascript'],
            '/personal.css': ['personal.css', 'text/css'],
            '/terminal.css': ['terminal.css', 'text/css'],
            '/style.css': ['style.css', 'text/css'],
            '/api/problems': ['problems.json', 'application/json'],
            '/psetter.html': ['psetter.html', 'text/html'],
            '/psetter.js': ['psetter.js', 'text/javascript'],
            '/problems.json': ['problems.json', 'application/json'],
            '/favicon.svg': ['favicon.svg', 'image/svg+xml']
        };
        const route = routes[req.url];
        if (!route) return send(404, '{"error":"Not found"}');
        send(200, await readFile(path.join(root, route[0])), route[1]);
    } catch (error) { send(400, JSON.stringify({ error: error.message })); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Problem editor: ${origin}\nKeep this window open while editing. Press Ctrl+C to stop.`));
