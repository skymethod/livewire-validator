import { checkEqual, checkMatches, checkTrue } from './check.ts';
import { fetchCommentsForUrl, FetchCommentsResult, Comment } from './comments.ts';
import { computeAttributeMap, parseFeedXml, validateFeedXml, ValidationCallbacks, XmlNode } from './validator.ts';

export class ValidatorAppVM {

    private nextJobId = 1;
    private currentJob: ValidationJob | undefined;

    get validating(): boolean { return this.currentJob !== undefined && !this.currentJob.done; }

    get messages(): readonly Message[] { return this.currentJob ? this.currentJob.messages : [] }

    get xml(): XmlNode | undefined { return this.currentJob?.xml; }

    get fetchCommentsResult(): FetchCommentsResult | undefined { return this.currentJob?.fetchCommentsResult; }

    onChange: () => void = () => {};

    start() {
        // load initial state, etc. noop for now
    }

    validateFeed(feedUrlStr: string) {
        feedUrlStr = feedUrlStr.trim();
        const job: ValidationJob = {
            id: this.nextJobId++,
            messages: [],
            done: false,
            cancelled: false,
        }
        this.currentJob = job;
        job.messages.push({ type: 'running', text: 'Validating', url: feedUrlStr });
        this.onChange();

        this.validateFeedAsync(feedUrlStr, job);
    }

    cancelValidation() {
        if (this.currentJob && !this.currentJob.done) {
            this.currentJob.cancelled = true;
            this.currentJob.done = true;
            this.onChange();
        }
    }

    //

    private async validateFeedAsync(feedUrlStr: string, job: ValidationJob): Promise<void> {
        const { messages } = job;
        const setStatus = (text: string, opts: { url?: string, type?: MessageType } = {}) => {
            const { url, type } = opts;
            messages[0] = { type: type || messages[0].type, text, url };
        };
        let activityPub: { url: string, subject: string } | undefined;
        try {
            if (feedUrlStr === '') throw new Error(`Bad url: <blank>`);
            const feedUrl = tryParseUrl(feedUrlStr);
            if (!feedUrl) throw new Error(`Bad url: ${feedUrlStr}`);
            checkMatches('feedUrl.protocol', feedUrl.protocol, /^https?:$/);

            feedUrl.searchParams.set('_t', Date.now().toString()); // cache bust

            const headers = { 'Accept-Encoding': 'gzip', 'User-Agent': navigator.userAgent, 'Cache-Control': 'no-store' };
            const { response, side, fetchTime } = await localOrRemoteFetch(feedUrl.toString(), { headers }); if (job.done) return;

            if (side === 'remote') {
                messages.push({ type: 'warning', text: `Local fetch failed (CORS issue?)`, url: feedUrlStr, tag: 'cors' });
            }
            checkEqual('response.status', response.status, 200);
            const contentType = response.headers.get('Content-Type');
            messages.push({ type: 'info', text: `Response status=${response.status}, content-type=${contentType}, content-length=${response.headers.get('Content-Length')}` });

            let start = Date.now();
            const text = await response.text(); if (job.done) return;
            const readTime = Date.now() - start;

            let validateFeed = true;
            if (contentType && contentType.includes('/html')) {
                messages.push({ type: 'info', text: 'Found html, trying again as ActivityPub' });
                validateFeed = false;
                activityPub = { url: feedUrlStr, subject: 'input url' };
            }

            let parseTime: number | undefined;
            let validateTime: number | undefined;
            if (validateFeed) {
                start = Date.now();
                
                let xml: XmlNode | undefined;
                try {
                    xml = parseFeedXml(text);
                } catch (e) {
                    messages.push({ type: 'error', text: `Xml parse failed: ${e.message}` });
                } finally {
                    parseTime = Date.now() - start;
                }
                job.xml = xml;
            
                console.log(xml);

                if (xml) {
                    start = Date.now();
                    const callbacks: ValidationCallbacks = {
                        onError: (_, message) => {
                            console.error(message);
                            messages.push({ type: 'error', text: message });
                        },
                        onWarning: (_, message) =>  {
                            console.warn(message);
                            messages.push({ type: 'warning', text: message });
                        },
                        onInfo: (node, message) =>  {
                            console.info(message);
                            messages.push({ type: 'info', text: message });
                            if (message.includes('socialInteract')) {
                                if (node.val && node.val !== '' && computeAttributeMap(node.attrsMap).get('platform') === 'activitypub') {
                                    const episodeTitle = findEpisodeTitle(node)
                                    activityPub = { url: node.val, subject: episodeTitle ? `“${episodeTitle}”` : 'episode' };
                                }
                            }
                        },
                    };
                    validateFeedXml(xml, callbacks);
                    validateTime = Date.now() - start;
                }
            }
            messages.push({ type: 'info', text: JSON.stringify({ fetchTime, readTime, parseTime, validateTime, textLength: text.length }) });

            if (activityPub) {
                const sleepMillisBetweenCalls = 0;
                setStatus(`Validating ActivityPub for ${activityPub.subject}`, { url: activityPub.url }); this.onChange();
                const keepGoing = () => !job.done;
                const remoteOnlyOrigins = new Set<string>();
                const computeUseSide = (url: string) => {
                    return remoteOnlyOrigins.has(new URL(url).origin) ? 'remote' : undefined;
                };
                const fetchActivityPub = async (url: string) => {
                    let { obj, side } = await localOrRemoteFetchFetchActivityPub(url, computeUseSide(url), sleepMillisBetweenCalls); if (!keepGoing()) return undefined;
                    console.log(JSON.stringify(obj, undefined, 2));
                    if (url.includes('/api/v1/statuses') && typeof obj.uri === 'string') {
                        // https://docs.joinmastodon.org/methods/statuses/
                        // https://docs.joinmastodon.org/entities/status/
                        // uri = URI of the status used for federation (i.e. the AP url)
                        url = obj.uri;
                        const res = await localOrRemoteFetchFetchActivityPub(url, computeUseSide(url), sleepMillisBetweenCalls); if (!keepGoing()) return undefined;
                        obj = res.obj;
                        side = res.side;
                        console.log(JSON.stringify(obj, undefined, 2));
                    }
                    if (side === 'remote') {
                        const origin = new URL(url).origin;
                        if (!remoteOnlyOrigins.has(origin)) {
                            messages.push({ type: 'warning', text: `Local ActivityPub fetch failed (CORS issue?)`, url, tag: 'cors' }); this.onChange();
                            remoteOnlyOrigins.add(origin);
                        }
                    }
                    return obj;
                };
                const warn = (comment: Comment, url: string, message: string) => {
                    messages.push({ type: 'warning', text: message, comment, url }); this.onChange();
                };
                const fetchCommentsResult = await fetchCommentsForUrl(activityPub.url, activityPub.subject, { keepGoing, fetchActivityPub, warn })
                job.fetchCommentsResult = fetchCommentsResult;
                this.onChange();
            }

        } catch (e) {
            console.error(e);
            messages.push({ type: 'error', text: e.message });
        } finally {
            job.done = true;
            setStatus(job.cancelled ? 'Cancelled' : 'Done', { type: 'done' });
            this.onChange();
        }
    }

}

export type MessageType = 'error' | 'warning' | 'info' | 'done' | 'running';

export interface Message {
    readonly type: MessageType;
    readonly text: string;
    readonly comment?: Comment;
    readonly url?: string;
    readonly tag?: string;
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

async function localOrRemoteFetchFetchActivityPub(url: string, useSide: FetchSide | undefined, sleepMillisBetweenCalls: number): Promise<{ obj: Record<string, unknown>, side: FetchSide }> {
    if (sleepMillisBetweenCalls > 0) await sleep(sleepMillisBetweenCalls);
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

function findEpisodeTitle(socialInteract: XmlNode): string | undefined {
    const item = socialInteract.parent;
    if (item) {
        const title = item.child['title'];
        if (title.length > 0 && title[0].val) {
            const val = title[0].val.trim();
            if (val.length > 0) {
                return val;
            }
        } 
    }
    return undefined;
}

//

type FetchSide = 'local' | 'remote';

interface FetchResult {
    readonly fetchTime: number;
    readonly side: FetchSide;
    readonly response: Response;
}

interface ValidationJob {
    readonly id: number;
    readonly messages: Message[]; // first message is status
    done: boolean;
    cancelled: boolean;
    xml?: XmlNode;
    fetchCommentsResult?: FetchCommentsResult;
}
