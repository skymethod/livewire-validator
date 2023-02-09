import { Bytes } from './deps_worker.ts';

export interface PodcastIndexCredentials {
    readonly apiKey: string;
    readonly apiSecret: string;
}

export interface SearchResult {
    readonly piSearchResult?: Record<string, unknown> | string;
    readonly piIdResult?: Record<string, unknown> | string;
    readonly piGuidResult?: Record<string, unknown> | string;
}

export async function search(input: string, opts: { headers: Record<string, string>, podcastIndexCredentials?: PodcastIndexCredentials }): Promise<SearchResult> {
    const { podcastIndexCredentials, headers } = opts;
    let piSearchResult: Record<string, unknown> | string | undefined;
    let piIdResult: Record<string, unknown> | string | undefined;
    let piGuidResult: Record<string, unknown> | string | undefined;
    if (podcastIndexCredentials) {
        let m: RegExpExecArray | null;
        if (/^\d+$/.test(input)) {
            try {
                const u = new URL('https://api.podcastindex.org/api/1.0/podcasts/byfeedid');
                u.searchParams.set('id', input);
                piIdResult = await fetchPodcastIndexJson(u.toString(), headers, podcastIndexCredentials);
            } catch (e) {
                piIdResult = e.message;
            }
        } else if ((m = /^id(\d+)$/.exec(input))) {
            try {
                const u = new URL('https://api.podcastindex.org/api/1.0/podcasts/byitunesid');
                u.searchParams.set('id', m[1]);
                piIdResult = await fetchPodcastIndexJson(u.toString(), headers, podcastIndexCredentials);
            } catch (e) {
                piIdResult = e.message;
            }
        } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) {
            try {
                const u = new URL('https://api.podcastindex.org/api/1.0/podcasts/byguid');
                u.searchParams.set('guid', input);
                piGuidResult = await fetchPodcastIndexJson(u.toString(), headers, podcastIndexCredentials);
            } catch (e) {
                piGuidResult = e.message;
            }
        } else {
            try {
                const u = new URL('https://api.podcastindex.org/api/1.0/search/byterm');
                u.searchParams.set('q', input);
                piSearchResult = await fetchPodcastIndexJson(u.toString(), headers, podcastIndexCredentials);
            } catch (e) {
                piSearchResult = e.message;
            }
        }
    }
    return { piSearchResult, piIdResult, piGuidResult };
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
