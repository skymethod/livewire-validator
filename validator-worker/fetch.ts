import { computeHttpSignatureHeaders, importKeyFromPem } from './deps_worker.ts';

export async function computeFetch(request: Request, { twitterCredentials, actorKeyId, actorPrivatePemText }: { twitterCredentials: string | undefined, actorKeyId: string | undefined, actorPrivatePemText: string | undefined }): Promise<Response> {
    try {
        if (request.method !== 'POST') throw new Error(`Bad method: ${request.method}`);
        const { url, headers = {} } = await request.json();
        console.log(`Fetching ${url}`, headers);
        if (new URL(url).hostname === 'api.twitter.com' && twitterCredentials) {
            headers.authorization = `Bearer ${twitterCredentials.split(':')[1]}`;
        }
        let rt = await fetch(new URL(url).toString(), { headers });
        if (rt.status === 401 && typeof headers.Accept === 'string' && headers.Accept.includes('activity+json') && actorKeyId && actorPrivatePemText) {
            // try signing the request
            const privateKey = await getOrLoadPrivateKey(actorPrivatePemText);
            const { signature, date } = await computeHttpSignatureHeaders({ method: 'GET', url: new URL(url).toString(), privateKey, keyId: actorKeyId });
            headers.signature = signature;
            headers.date = date;
            rt = await fetch(new URL(url).toString(), { headers });
        }
        if (rt.url !== url) {
            console.log(`${url} -> ${rt.url}`);
            const headers = new Headers(rt.headers);
            headers.set('x-response-url', rt.url);
            const { status } = rt;
            rt = new Response(await rt.text(), { status, headers });
        }
        if (rt.status !== 200) {
            console.log(`Response ${rt.status}`, [...rt.headers.entries()].map(v => v.join(':')).join(', '));
        }
        return rt;
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400 });
    }
}

//

const privateKeys: Record<string, CryptoKey> = {};

async function getOrLoadPrivateKey(privatePemText: string): Promise<CryptoKey> {
    const existing = privateKeys[privatePemText];
    if (existing) return existing;

    const key = await importKeyFromPem(privatePemText, 'private');
    privateKeys[privatePemText] = key;
    return key;
}
