import { Bytes } from './deps_worker.ts';

export interface PodcastIndexCredentials {
    readonly apiKey: string;
    readonly apiSecret: string;
}

export interface SearchResult {
    readonly piSearchResult?: Record<string, unknown> | string;
}

export async function search(input: string, opts: { headers: Record<string, string>, podcastIndexCredentials?: PodcastIndexCredentials }): Promise<SearchResult> {
    const { podcastIndexCredentials, headers } = opts;
    let piSearchResult: Record<string, unknown> | string | undefined;
    if (podcastIndexCredentials) {
        try {
            const u = new URL('https://api.podcastindex.org/api/1.0/search/byterm');
            u.searchParams.set('q', input);
            piSearchResult = await fetchPodcastIndexJson(u.toString(), headers, podcastIndexCredentials);
        } catch (e) {
            piSearchResult = e.message;
        }
    }
    return { piSearchResult };
}

//

async function fetchPodcastIndexJson(url: string, headersInit: Record<string, string>, podcastIndexCredentials: PodcastIndexCredentials): Promise<Record<string, unknown>> {
    const{ apiKey, apiSecret } = podcastIndexCredentials;
    const xAuthDate = `${Date.now() / 1000}`;
    const authorization = (await Bytes.ofUtf8(`${apiKey}${apiSecret}${xAuthDate}`).sha1()).hex();
    const headers = {...{ 'X-Auth-Key': apiKey, 'X-Auth-Date': xAuthDate, 'Authorization': authorization, 'Accept-Encoding': 'gzip' }, ...headersInit };
    const res = await fetch(url, { headers });
    if (res.status !== 200) {
        const message = `Bad res.status ${res.status}: expected 200`;
        console.error(message, await res.text());
        throw new Error(message);
    }
    const contentType = res.headers.get('Content-Type');
    if (contentType !== 'application/json') {
        const message = `Bad res.contentType ${contentType}: expected application/json`;
        console.error(message, await res.text());
        throw new Error(message);
    }
    return await res.json();
}
