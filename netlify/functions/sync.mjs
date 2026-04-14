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

    let store;
    try {
        store = getStore({ name: STORE, consistency: 'strong' });
    } catch (e) {
        return json({ error: 'store init failed', msg: String(e?.message || e) }, { status: 500 });
    }

    if (req.method === 'GET') {
        try {
            const raw = await store.get(id);
            if (raw == null) return json(null);
            try { return json(JSON.parse(raw)); }
            catch { return json({ error: 'stored value not json', raw }, { status: 500 }); }
        } catch (e) {
            return json({ error: 'get failed', msg: String(e?.message || e) }, { status: 500 });
        }
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
        try {
            await store.set(id, JSON.stringify(parsed));
            const verify = await store.get(id);
            return json({ ok: true, updatedAt: parsed.updatedAt, verifyLen: verify?.length ?? null });
        } catch (e) {
            return json({ error: 'set failed', msg: String(e?.message || e) }, { status: 500 });
        }
    }

    return json({ error: 'method not allowed' }, { status: 405 });
};

export const config = { path: '/api/sync' };
