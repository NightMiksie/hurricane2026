import { getStore } from '@netlify/blobs';

const STORE = 'packliste';
const MAX_SIZE = 200_000;

const json = (body, init = {}) => new Response(JSON.stringify(body), {
    ...init,
    headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        ...(init.headers || {})
    }
});

export default async (req) => {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id || !/^[a-z0-9-]{6,40}$/.test(id)) {
        return json({ error: 'invalid id' }, { status: 400 });
    }

    const store = getStore({ name: STORE, consistency: 'strong' });

    if (req.method === 'GET') {
        const raw = await store.get(id);
        if (raw == null) return json(null);
        return new Response(raw, {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
        });
    }

    if (req.method === 'PUT') {
        const text = await req.text();
        if (text.length > MAX_SIZE) {
            return json({ error: 'payload too large' }, { status: 413 });
        }
        let parsed;
        try { parsed = JSON.parse(text); }
        catch { return json({ error: 'invalid json' }, { status: 400 }); }

        if (!parsed || typeof parsed !== 'object'
            || !Array.isArray(parsed.categories)
            || typeof parsed.updatedAt !== 'number') {
            return json({ error: 'invalid shape' }, { status: 400 });
        }
        await store.set(id, JSON.stringify(parsed));
        return json({ ok: true, updatedAt: parsed.updatedAt });
    }

    return json({ error: 'method not allowed' }, { status: 405 });
};

export const config = { path: '/api/sync' };
