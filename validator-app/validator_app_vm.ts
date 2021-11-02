import { checkEqual, checkMatches, checkTrue } from './check.ts';
import { fetchCommentsForUrl } from './comments.ts';
import { computeAttributeMap, parseFeedXml, validateFeedXml, ValidationCallbacks, XmlNode } from './validator.ts';

export class ValidatorAppVM {

    private _validating = false;
    get validating(): boolean { return this._validating; }

    private _status = '';
    get status(): string { return this._status; }

    private _messages: Message[] = [];
    get messages(): readonly Message[] { return this._messages; }

    private _xml: XmlNode | undefined;
    get xml(): XmlNode | undefined { return this._xml; }

    onChange: () => void = () => {};

    start() {
        // load initial state, etc. noop for now
    }

    validateFeed(feedUrlStr: string) {
        feedUrlStr = feedUrlStr.trim();
        this._status = 'Validating ' + feedUrlStr;
        this._messages.splice(0);
        this._xml = undefined;
        this._validating = true;
        this.onChange();

        this.validateFeedAsync(feedUrlStr).catch(e => {
            this._messages.push({ type: 'error', text: e.message });
            this._validating = false;
            this.onChange();
        })
    }

    cancelValidation() {
        if (!this._validating) return;
        this._validating = false;
        this.onChange();
    }

    //

    private async validateFeedAsync(feedUrlStr: string): Promise<void> {
        const activityPubRootCommentNodeUrls: string[] = [];
        try {
            if (feedUrlStr === '') throw new Error(`Bad url: <blank>`);
            const feedUrl = tryParseUrl(feedUrlStr);
            if (!feedUrl) throw new Error(`Bad url: ${feedUrlStr}`);
            checkMatches('feedUrl.protocol', feedUrl.protocol, /^https?:$/);

            feedUrl.searchParams.set('_t', Date.now().toString()); // cache bust

            const headers = { 'Accept-Encoding': 'gzip', 'User-Agent': navigator.userAgent, 'Cache-Control': 'no-store' };
            const { response, side, fetchTime } = await localOrRemoteFetch(feedUrl.toString(), { headers }); if (!this._validating) return;
            if (side === 'remote') {
                this._messages.push({ type: 'warning', text: `Local feed fetch failed: CORS issue?` });
            }
            checkEqual('response.status', response.status, 200);
            this._messages.push({ type: 'info', text: `Response status=${response.status}, content-type=${response.headers.get('Content-Type')}, content-length=${response.headers.get('Content-Length')}` });

            let start = Date.now();
            const text = await response.text(); if (!this._validating) return;
            const readTime = Date.now() - start;

            start = Date.now();
            let parseTime = 0;
            let xml: XmlNode | undefined;
            try {
                xml = parseFeedXml(text);
            } catch (e) {
                this._messages.push({ type: 'error', text: `Xml parse failed: ${e.message}` });
            } finally {
                parseTime = Date.now() - start;
            }
            this._xml = xml;
          
            console.log(xml);

            let validateTime: number | undefined;
            if (xml) {
                start = Date.now();
                const callbacks: ValidationCallbacks = {
                    onError: (_, message) => {
                        console.error(message);
                        this._messages.push({ type: 'error', text: message });
                    },
                    onWarning: (_, message) =>  {
                        console.warn(message);
                        this._messages.push({ type: 'warning', text: message });
                    },
                    onInfo: (node, message) =>  {
                        console.info(message);
                        this._messages.push({ type: 'info', text: message });
                        if (message.includes('socialInteract')) {
                            if (node.val && node.val !== '' && computeAttributeMap(node.attrsMap).get('platform') === 'activitypub') {
                                activityPubRootCommentNodeUrls.push(node.val);
                            }
                        }
                    },
                };
                validateFeedXml(xml, callbacks);
                validateTime = Date.now() - start;
            }

            this._messages.push({ type: 'info', text: JSON.stringify({ fetchTime, readTime, parseTime, validateTime, textLength: text.length }) });

            if (activityPubRootCommentNodeUrls.length > 0) {
                for (const activityPubRootCommentNodeUrl of activityPubRootCommentNodeUrls) {
                    this._status = `Validating activityPubRootCommentNodeUrl: ${activityPubRootCommentNodeUrl}`; this.onChange();
                    const keepGoing = () => this._validating;
                    const remoteOnlyOrigins = new Set<string>();
                    const computeUseSide = (url: string) => remoteOnlyOrigins.has(new URL(url).origin) ? 'remote' : undefined;
                    const fetchActivityPub = async (url: string) => {
                        let { obj, side } = await localOrRemoteFetchFetchActivityPub(url, computeUseSide(url)); if (!keepGoing()) return undefined;
                        console.log(JSON.stringify(obj, undefined, 2));
                        if (url.includes('/api/v1/statuses') && typeof obj.uri === 'string') {
                            // https://docs.joinmastodon.org/methods/statuses/
                            // https://docs.joinmastodon.org/entities/status/
                            // uri = URI of the status used for federation (i.e. the AP url)
                            url = obj.uri;
                            const res = await localOrRemoteFetchFetchActivityPub(url, computeUseSide(url)); if (!keepGoing()) return undefined;
                            obj = res.obj;
                            side = res.side;
                            console.log(JSON.stringify(obj, undefined, 2));
                        }
                        if (side === 'remote') {
                            const origin = new URL(url).origin;
                            if (!remoteOnlyOrigins.has(origin)) {
                                this._messages.push({ type: 'warning', text: `Local ActivityPub fetch failed (CORS issue?): ${url}` }); this.onChange();
                                remoteOnlyOrigins.add(origin);
                            }
                        }
                        return obj;
                    };
                    const rootComment = await fetchCommentsForUrl(activityPubRootCommentNodeUrl, { keepGoing, fetchActivityPub })
                    console.log('comments', JSON.stringify(rootComment, undefined, 2));
                }
            }

        } catch (e) {
            this._messages.push({ type: 'error', text: e.message });
        } finally {
            this._status = '';
            this.onChange();
        }
    }

}

export type MessageType = 'error' | 'warning' | 'info';

export interface Message {
    readonly type: MessageType;
    readonly text: string;
}

//

function tryParseUrl(url: string): URL | undefined {
    try {
        return new URL(url);
    } catch {
        return undefined;
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function localOrRemoteFetchFetchActivityPub(url: string, useSide: FetchSide | undefined): Promise<{ obj: Record<string, unknown>, side: FetchSide }> {
    await sleep(500);
    const { response, side } = await localOrRemoteFetch(url, { headers: { 'Accept': 'application/activity+json' }, useSide });
    checkEqual('res.status', response.status, 200);
    console.log([...response.headers].map(v => v.join(': ')));
    const contentType = response.headers.get('Content-Type');
    checkTrue('res.contentType', contentType, (contentType || '').includes('json')); // application/activity+json; charset=utf-8, application/json
    const obj = await response.json();
    return { obj, side };
}

async function localOrRemoteFetch(url: string, opts: { headers?: Record<string, string>, useSide?: FetchSide } = {}): Promise<FetchResult> {
    const { headers, useSide } = opts;
    if (useSide !== 'remote') {
        try {
            console.log(`local fetch: ${url}`);
            const start = Date.now();
            const response = await fetch(url, { headers });
            return { fetchTime: Date.now() - start, side: 'local', response };
        } catch (e) {
            console.log('Failed to local fetch, trying remote', e);
        }
    }
    console.log(`remote fetch: ${url}`);
    const start = Date.now();
    const response = await fetch(`/f/${url.replaceAll(/[^a-zA-Z0-9.]+/g, '_')}`, { method: 'POST', body: JSON.stringify({ url, headers }) });
    return { fetchTime: Date.now() - start, side: 'remote', response };
}

//

type FetchSide = 'local' | 'remote';

interface FetchResult {
    readonly fetchTime: number;
    readonly side: FetchSide;
    readonly response: Response;
}
