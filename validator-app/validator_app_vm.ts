import { checkEqual, checkMatches } from './check.ts';
import { fetchCommentsForUrl, FetchCommentsResult, Comment, computeCommentCount } from './comments.ts';
import { computeAttributeMap, parseFeedXml, RuleReference, validateFeedXml, ValidationCallbacks, XmlNode } from './validator.ts';
import { isReadonlyArray } from './util.ts';

export class ValidatorAppVM {

    private nextJobId = 1;
    private currentJob: ValidationJob | undefined;

    get validating(): boolean { return this.currentJob !== undefined && !this.currentJob.done; }

    get messages(): readonly Message[] { return this.currentJob ? this.currentJob.messages : []; }

    get isSearch(): boolean { return this.currentJob !== undefined && this.currentJob.search; }

    get searchResults(): readonly PIFeedInfo[] { return this.currentJob ? this.currentJob.searchResults : []; }

    get xml(): XmlNode | undefined { return this.currentJob?.xml; }

    get fetchCommentsResult(): FetchCommentsResult | undefined { return this.currentJob?.fetchCommentsResult; }

    onChange: () => void = () => {};

    start() {
        // load initial state, etc. noop for now
    }

    continueWith(url: string) {
        const { currentJob } = this;
        if (currentJob) {
            currentJob.done = false;
            currentJob.search = false;
            currentJob.searchResults.splice(0);
            currentJob.messages[0] = { type: 'running', text: 'Validating' };
            currentJob.messages.push({ type: 'info', text: 'Continuing with feed from search', url });
            this.onChange();
            this.validateAsync(url, currentJob);
        }
    }

    startValidation(input: string, options: ValidationOptions = { }) {
        const job: ValidationJob = {
            id: this.nextJobId++,
            messages: [],
            searchResults: [],
            times: {},
            options,
            search: false,
            done: false,
            cancelled: false,
        }
        this.currentJob = job;
        job.messages.push({ type: 'running', text: 'Validating' });
        this.onChange();

        this.validateAsync(input, job);
    }

    cancelValidation() {
        if (this.currentJob && !this.currentJob.done) {
            this.currentJob.cancelled = true;
            this.currentJob.done = true;
            this.onChange();
        }
    }

    //

    private async validateAsync(input: string, job: ValidationJob): Promise<void> {
        input = normalizeInput(input);
        const { messages } = job;
        const setStatus = (text: string, opts: { url?: string, type?: MessageType } = {}) => {
            const { url, type } = opts;
            messages[0] = { type: type || messages[0].type, text, url };
            this.onChange();
        };
        const addMessage = (type: MessageType, text: string, opts: { tag?: string, url?: string, comment?: Comment, reference?: RuleReference } = {}) => {
            const { url, tag, comment, reference } = opts;
            messages.push({ type, text, tag, url, comment, reference });
            this.onChange();
        };

        let activityPub: { url: string, subject: string } | undefined;
        const headers = { 'Accept-Encoding': 'gzip', 'User-Agent': navigator.userAgent, 'Cache-Control': 'no-store' };
        let continueWithUrl: string | undefined;
        const jobStart = Date.now();
        try {
            input = input.trim();
            if (input === '') throw new Error(`No input`);
            if (/^https?:\/\/.+/i.test(input)) {
                // we have an url, validate it

                const inputUrl = tryParseUrl(input);
                if (!inputUrl) throw new Error(`Bad url: ${input}`);
                checkMatches('inputUrl.protocol', inputUrl.protocol, /^https?:$/);

                inputUrl.searchParams.set('_t', Date.now().toString()); // cache bust

                const { response, side, fetchTime } = await localOrRemoteFetch(inputUrl.toString(), { headers }); if (job.done) return;
                job.times.fetchTime = fetchTime;

                if (side === 'local') {
                    addMessage('good', `Local fetch succeeded (CORS enabled)`, { url: input }); 
                }
                checkEqual(`${inputUrl.host} response status`, response.status, 200);
                const contentType = response.headers.get('Content-Type');

                let validateFeed = true;
                if (contentType && contentType.includes('/html')) {
                    addMessage('info', 'Found html, will try again as ActivityPub');
                    validateFeed = false;
                    activityPub = { url: input, subject: 'input url' };
                }

                let textLength: number | undefined;
                if (validateFeed) {
                    let start = Date.now();
                    const text = await response.text(); if (job.done) return;
                    textLength = text.length;
                    job.times.readTime = Date.now() - start;

                    start = Date.now();
                    
                    let xml: XmlNode | undefined;
                    try {
                        xml = parseFeedXml(text);
                        console.log(xml);
                    } catch (e) {
                        addMessage('error', `Xml parse failed: ${e.message}`);
                    } finally {
                        job.times.parseTime = Date.now() - start;
                    }

                    if (xml && Object.keys(xml).length > 0) job.xml = xml; // empty root if not actually xml

                    if (xml) {
                        start = Date.now();
                        const callbacks: ValidationCallbacks = {
                            onGood: (_, message, opts) => {
                                console.info(message);
                                addMessage('good', message, opts);
                            },
                            onError: (_, message, opts) => {
                                console.error(message);
                                addMessage('error', message, opts);
                            },
                            onWarning: (_, message, opts) =>  {
                                console.warn(message);
                                addMessage('warning', message, opts);
                            },
                            onInfo: (node, message, opts) =>  {
                                console.info(message);
                                addMessage('info', message, opts);
                                if (opts?.tag === 'social-interact') {
                                    if (node.val && node.val !== '' && computeAttributeMap(node.attrsMap).get('platform') === 'activitypub') {
                                        const episodeTitle = findEpisodeTitle(node)
                                        activityPub = { url: node.val, subject: episodeTitle ? `“${episodeTitle}”` : 'episode' };
                                    }
                                }
                            },
                        };
                        validateFeedXml(xml, callbacks);
                        job.times.validateTime = Date.now() - start;
                    }
                }

                const validateComments = job.options.validateComments !== undefined ? job.options.validateComments : true;
                if (activityPub && !validateComments) {
                    addMessage('info', 'Comments validation disabled, not fetching ActivityPub');
                } else if (activityPub) {
                    const sleepMillisBetweenCalls = 0;
                    setStatus(`Validating ActivityPub for ${activityPub.subject}`, { url: activityPub.url });
                    addMessage('info', 'Fetching ActivityPub comments', { url: activityPub.url });
                    const keepGoing = () => !job.done;
                    const remoteOnlyOrigins = new Set<string>();
                    const computeUseSide = (url: string) => {
                        return remoteOnlyOrigins.has(new URL(url).origin) ? 'remote' : undefined;
                    };
                    let activityPubCalls = 0;
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
                                addMessage('warning', `Local ActivityPub fetch failed (CORS disabled?)`, { url, tag: 'cors' });
                                remoteOnlyOrigins.add(origin);
                            }
                        }
                        activityPubCalls++;
                        return obj;
                    };
                    const warn = (comment: Comment, url: string, message: string) => {
                        addMessage('warning', message, { comment, url });
                    };
                    const start = Date.now();
                    const fetchCommentsResult = await fetchCommentsForUrl(activityPub.url, activityPub.subject, { keepGoing, fetchActivityPub, warn });
                    if (fetchCommentsResult) {
                        job.times.commentsTime = Date.now() - start;
                        addMessage('info', `Found ${unitString(computeCommentCount(fetchCommentsResult.rootComment), 'comment')} and ${unitString(fetchCommentsResult.commenters.size, 'participant')}, made ${unitString(activityPubCalls, 'ActivityPub call')}`);
                    }
                    job.fetchCommentsResult = fetchCommentsResult;
                    this.onChange();
                }
            } else {
                // not an url, do a search instead
                job.search = true;
                setStatus('Searching');
                const searchResponse = await fetch(`/s`, { method: 'POST', body: JSON.stringify({ input, headers }) });
                checkEqual('searchResponse.status', searchResponse.status, 200);
                const searchResult = await searchResponse.json() as SearchResult;
                if (searchResult.piSearchResult) {
                    if (typeof searchResult.piSearchResult === 'string') {
                        addMessage('error', searchResult.piSearchResult);
                    } else {
                        job.searchResults.push(...searchResult.piSearchResult.feeds.slice(0, 20));
                    }
                } else if (searchResult.piIdResult) {
                    if (typeof searchResult.piIdResult === 'string') {
                        addMessage('error', searchResult.piIdResult);
                    } else {
                        if (!isReadonlyArray(searchResult.piIdResult.feed)) {
                            continueWithUrl = searchResult.piIdResult.feed.url;
                        }
                    }
                }
            }
        } catch (e) {
            console.error(e);
            addMessage('error', e.message);
        } finally {
            addMessage('info', `${job.search ? 'Search took' : 'Took'} ${formatTime(Date.now() - jobStart)}${computeJobTimesStringSuffix(job)}`);
            if (continueWithUrl) {
                this.continueWith(continueWithUrl);
            } else {
                job.done = true;
                const status = job.cancelled ? 'Cancelled'
                    : job.search && job.searchResults.length === 0 ? 'Found no podcasts'
                    : job.search && job.searchResults.length === 1 ? 'Found one podcast, select to continue'
                    : job.search ? `Found ${job.searchResults.length} podcasts, select one to continue` 
                    : 'Done';
                setStatus(status, { type: 'done' });
            }
           
        }
    }

}

export type MessageType = 'error' | 'warning' | 'info' | 'done' | 'running' | 'good';

export interface Message {
    readonly type: MessageType;
    readonly text: string;
    readonly comment?: Comment;
    readonly url?: string;
    readonly tag?: string;
    readonly reference?: RuleReference;
}

export interface ValidationOptions {
    readonly validateComments?: boolean; // default = true
}

export interface PIFeedInfo {
    /** Current feed URL */
    readonly url: string;

    /** The URL of the feed, before it changed to the current url value */
    readonly originalUrl?: string;

    /** Name of the feed */
    readonly title: string;

    /** The channel-level author element. */
    readonly author?: string;

    /** The seemingly best artwork we can find for the feed. Might be the same as image in most instances. */
    readonly artwork?: string;
}

//

function formatTime(millis: number): string {
    if (millis < 1000) return `${millis}ms`;
    return `${Math.round(millis / 1000 * 100) / 100}s`;
}

function computeJobTimesStringSuffix(job: ValidationJob): string {
    const rt = [['fetch', job.times.fetchTime],['read', job.times.readTime],['parse', job.times.parseTime],['validate', job.times.validateTime],['comments', job.times.commentsTime]]
        .filter(v => v[1] !== undefined)
        .map(v => `${v[0]}=${formatTime(v[1] as number)}`)
        .join(', ');
    return rt === '' ? '' : ` (${rt})`;
}

function unitString(amount: number, unit: string): string {
    return `${amount === 0 ? 'no' : amount === 1 ? 'one' : amount} ${unit}${amount === 1 ? '' : 's'}`;
}

function normalizeInput(input: string): string {
    input = input.trim();
    const m = /^https:\/\/podcasts\.apple\.com\/.*?(id\d+)$/.exec(input);
    if (m) return m[1];
    return input;
}

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
    if (!(contentType || '').includes('json')) { // application/activity+json; charset=utf-8, application/json
        throw new Error('Found html, not ActivityPub');
    }
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
    readonly searchResults: PIFeedInfo[];
    readonly options: ValidationOptions;
    readonly times: ValidationJobTimes;
    search: boolean;
    done: boolean;
    cancelled: boolean;
    xml?: XmlNode;
    fetchCommentsResult?: FetchCommentsResult;
}

interface ValidationJobTimes {
    fetchTime?: number;
    readTime?: number;
    parseTime?: number;
    validateTime?: number;
    commentsTime?: number;
}

interface SearchResult {
    readonly piSearchResult?: PISearchResponse | string;
    readonly piIdResult?: PIIdResponse | string;
}

interface PISearchResponse {
    readonly feeds: readonly PIFeedInfo[];
}

interface PIIdResponse {
    readonly feed: PIFeedInfo | readonly PIFeedInfo[]; // empty array when not found
}

