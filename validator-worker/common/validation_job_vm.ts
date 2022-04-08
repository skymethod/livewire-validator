import { checkMatches, checkEqual } from './check.ts';
import { Qnames } from './qnames.ts';
import { isReadonlyArray } from './util.ts';
import { RuleReference, MessageOptions, ValidationCallbacks, validateFeedXml, podcastIndexReference } from './validator.ts';
import { computeAttributeMap, ExtendedXmlNode, parseXml } from './xml_parser.ts';
import { setIntersect } from './sets.ts';
import { InMemoryCache, Callbacks, Comment, makeRateLimitedFetcher, makeThreadcap, Threadcap, updateThreadcap, Fetcher as ThreadcapFetcher } from './deps_comments.ts';

export type ValidationJobVMOpts = { localFetcher: Fetcher, remoteFetcher: Fetcher, piSearchFetcher: PISearchFetcher, threadcapUserAgent: string };

export class ValidationJobVM {

    private readonly fetchers: Fetchers;
    private readonly piSearchFetcher: PISearchFetcher;
    private readonly threadcapUserAgent: string;

    private nextJobId = 1;
    private currentJob: ValidationJob | undefined;

    //

    get validating(): boolean { return this.currentJob !== undefined && !this.currentJob.done; }
    get done(): boolean { return this.currentJob !== undefined && this.currentJob.done; }

    get messages(): readonly Message[] { return this.currentJob ? this.currentJob.messages : []; }

    get isSearch(): boolean { return this.currentJob !== undefined && this.currentJob.search; }

    get searchResults(): readonly PIFeedInfo[] { return this.currentJob ? this.currentJob.searchResults : []; }

    get xml(): ExtendedXmlNode | undefined { return this.currentJob?.xml; }

    get xmlSummaryText(): string | undefined { return this.currentJob?.xmlSummaryText; }

    get commentsResults(): CommentsResult[] | undefined { return this.currentJob?.commentsResults; }

    constructor(opts: ValidationJobVMOpts) {
        const { localFetcher, remoteFetcher, piSearchFetcher, threadcapUserAgent } = opts;
        this.fetchers = { localFetcher, remoteFetcher };
        this.piSearchFetcher = piSearchFetcher;
        this.threadcapUserAgent = threadcapUserAgent;
    }

    onChange: () => void = () => {};

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

    startValidation(input: string, options: ValidationOptions) {
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

    async fetch(url: string, opts: { headers?: Record<string, string> }): Promise<FetchResult> {
        const { headers } = opts;
        const { fetchers } = this;
        return await localOrRemoteFetch(url, { fetchers, headers });
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

        // deno-lint-ignore no-explicit-any
        let activityPub: { url: string, subject: string, obj?: any } | undefined;
        let lightningComments: { url: string, subject: string } | undefined;
        let twitter: { url: string, subject: string } | undefined;
        const headers = { 'Accept-Encoding': 'gzip', 'User-Agent': job.options.userAgent, 'Cache-Control': 'no-store' };
        let continueWithUrl: string | undefined;
        const jobStart = Date.now();
        const { fetchers, piSearchFetcher } = this;
        try {
            input = input.trim();
            if (input === '') throw new Error(`No input`);
            if (/^https?:\/\/.+/i.test(input)) {
                // we have an url, validate it

                const inputUrl = tryParseUrl(input);
                if (!inputUrl) throw new Error(`Bad url: ${input}`);
                checkMatches('inputUrl.protocol', inputUrl.protocol, /^https?:$/);

                // https://feed.podbean.com/<slug>/feed.xml => 405 method not allowed for any query param
                if (inputUrl.hostname !== 'feed.podbean.com') {
                    inputUrl.searchParams.set('_t', Date.now().toString()); // cache bust
                }

                const { response, side, fetchTime } = await localOrRemoteFetch(inputUrl.toString(), { fetchers, headers }); if (job.done) return;
                job.times.fetchTime = fetchTime;

                if (side === 'local') {
                    addMessage('good', `Local fetch succeeded (CORS enabled)`, { url: input }); 
                }
                checkEqual(`${inputUrl.host} response status`, response.status, 200);
                const contentType = response.headers.get('Content-Type');

                let validateFeed = true;
                if (contentType && contentType.includes('/html')) {
                    if (inputUrl.hostname.endsWith('twitter.com')) {
                        addMessage('info', 'Found html, will try again as Twitter');
                        validateFeed = false;
                        twitter = { url: input, subject: 'input url' };
                    } else {
                        addMessage('info', 'Found html, will try again as ActivityPub');
                        validateFeed = false;
                        activityPub = { url: input, subject: 'input url' };
                    }
                }
                if (contentType && contentType.startsWith('application/activity+json')) {
                    addMessage('info', 'Found ActivityPub json');
                    const obj = await response.json();
                    validateFeed = false;
                    activityPub = { url: input, subject: 'input url', obj };
                }

                if (validateFeed) {
                    let start = Date.now();
                    const text = await response.text(); if (job.done) return;
                    job.times.readTime = Date.now() - start;

                    start = Date.now();
                    
                    let xml: ExtendedXmlNode | undefined;
                    try {
                        xml = parseXml(text);
                        console.log(xml);
                    } catch (e) {
                        console.error(e);
                        const message = typeof e.message === 'string' ? e.message: '';
                        const knownInvalid = message === `Cannot read properties of undefined (reading 'parent')`; // thrown by getTraversalObj
                        addMessage('error', `Xml parse failed: ${knownInvalid ? 'Invalid xml' : e.message}`);
                    } finally {
                        job.times.parseTime = Date.now() - start;
                    }

                    if (xml) {
                        start = Date.now();
                        const onMessage = (type: MessageType, node: ExtendedXmlNode, message: string, opts: MessageOptions | undefined) => {
                            addMessage(type, message, opts);
                            if (opts?.tag === 'social-interact') {
                                const attributes = computeAttributeMap(node.attrsMap);
                                const uri = attributes.get('uri') || node.val;
                                if (uri) {
                                    if (attributes.get('platform')?.toLowerCase() === 'activitypub' || attributes.get('protocol')?.toLowerCase() === 'activitypub') {
                                        const episodeTitle = findEpisodeTitle(node)
                                        activityPub = { url: uri, subject: episodeTitle ? `“${episodeTitle}”` : 'episode' };
                                    }
                                    if (attributes.get('protocol')?.toLowerCase() === 'lightningcomments') {
                                        const episodeTitle = findEpisodeTitle(node)
                                        lightningComments = { url: uri, subject: episodeTitle ? `“${episodeTitle}”` : 'episode' };
                                    }
                                    if (attributes.get('protocol')?.toLowerCase() === 'twitter') {
                                        const episodeTitle = findEpisodeTitle(node)
                                        twitter = { url: uri, subject: episodeTitle ? `“${episodeTitle}”` : 'episode' };
                                    }
                                }
                            }
                        };
  
                        const knownPiTags = new Set<string>();
                        const unknownPiTags = new Set<string>();
                        const piNamespaceUris = new Set<string>();
                        let rssItemInfo: { itemsCount: number, itemsWithEnclosuresCount: number } | undefined;
                        let piLiveItemsCount = 0;
                        const callbacks: ValidationCallbacks = {
                            onGood: (node, message, opts) => {
                                console.info(message);
                                onMessage('good', node, message, opts);
                            },
                            onError: (node, message, opts) => {
                                console.error(message);
                                onMessage('error', node, message, opts);
                            },
                            onWarning: (node, message, opts) =>  {
                                console.warn(message);
                                onMessage('warning', node, message, opts);
                            },
                            onInfo: (node, message, opts) =>  {
                                console.info(message);
                                onMessage('info', node, message, opts);
                            },
                            onPodcastIndexTagNamesFound: (known, unknown, namespaceUris) => {
                                known.forEach(v => knownPiTags.add(v));
                                unknown.forEach(v => unknownPiTags.add(v));
                                namespaceUris.forEach(v => piNamespaceUris.add(v));
                            },
                            onRssItemsFound: (itemsCount, itemsWithEnclosuresCount) => {
                                rssItemInfo = { itemsCount, itemsWithEnclosuresCount};
                            },
                            onPodcastIndexLiveItemsFound: (liveItemsCount) => {
                                piLiveItemsCount = liveItemsCount;
                            },
                        };
                        let xmlSummaryText = 'Xml structure';
                        validateFeedXml(xml, callbacks);
                        job.times.validateTime = Date.now() - start;

                        if (rssItemInfo) {
                            const { itemsCount, itemsWithEnclosuresCount } = rssItemInfo;
                            const itemsWithoutEnclosuresCount = itemsCount - itemsWithEnclosuresCount;
                            const pieces = [ `Found ${unitString(itemsWithEnclosuresCount, 'episode')}` ];
                            if (itemsWithoutEnclosuresCount > 0) pieces.push(`and ${unitString(itemsWithoutEnclosuresCount, 'item')} without enclosures`);
                            if (piLiveItemsCount > 0) pieces.push(`and ${unitString(piLiveItemsCount, 'liveItem')}`);
                            pieces.push(`in a ${formatBytes(text.length)} feed`);
                            addMessage('info', pieces.join(' '));
                            xmlSummaryText = `${itemsWithEnclosuresCount > 1 ? 'Podcast feed' : 'Feed'} structure`;
                        }
                        const piReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md');
                        const tagString = (set: ReadonlySet<string>) => [...set].map(v => `<podcast:${v}>`).join(', ');
                        if (knownPiTags.size > 0) {
                            addMessage('good', `Found ${unitString(knownPiTags.size, 'podcast namespace tag')}: ${tagString(knownPiTags)}`, { reference: piReference });
                        }
                        if (unknownPiTags.size > 0) {
                            addMessage('warning', `Found ${unitString(unknownPiTags.size, 'unknown podcast namespace tag')}: ${tagString(unknownPiTags)}`, { reference: piReference });
                        }
                        const misspelledNamespaces = setIntersect(piNamespaceUris, new Set(Qnames.PodcastIndex.KNOWN_MISSPELLED_NAMESPACES));
                        if (misspelledNamespaces.size > 0) {
                            const reference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#rss-namespace-extension-for-podcasting-tag-specification');
                            addMessage('warning', `Found ${unitString(misspelledNamespaces.size, 'misspelled podcast namespace uri')}: ${[...misspelledNamespaces].join(', ')}`, { reference });
                        }

                        if (xml && Object.keys(xml).length > 0) { // fast-xml-parser returns empty root if not actually xml
                            job.xml = xml;
                            job.xmlSummaryText = xmlSummaryText;
                            this.onChange();
                        }

                    }
                }

                const hasComments = activityPub || lightningComments || twitter;
                const validateComments = job.options.validateComments !== undefined ? job.options.validateComments : true;
                if (hasComments && !validateComments) {
                    addMessage('info', 'Comments validation disabled, not fetching comments');
                } else if (hasComments) {
                    const results: CommentsResult[] = [];
                    if (activityPub) {
                        const sleepMillisBetweenCalls = 0;
                        setStatus(`Validating ActivityPub for ${activityPub.subject}`, { url: activityPub.url });
                        addMessage('info', 'Fetching ActivityPub comments', { url: activityPub.url });
                        const keepGoing = () => !job.done;
                        const remoteOnlyOrigins = new Set<string>();
                        const computeUseSide = (url: string) => {
                            return remoteOnlyOrigins.has(new URL(url).origin) ? 'remote' : undefined;
                        };
                        let activityPubCalls = 0;
                        const fetchActivityPubOrMastodon: ThreadcapFetcher = async (url, opts) => {
                            const { headers } = opts || {};
                            const localOrRemoteFetchFunction = headers && headers.accept === 'application/json' ? localOrRemoteFetchJson : localOrRemoteFetchActivityPub;
                            let { response, side } = await localOrRemoteFetchFunction(url, fetchers, computeUseSide(url), sleepMillisBetweenCalls); 
                            let obj = await response.clone().json();
                            console.log(JSON.stringify(obj, undefined, 2));
                            if (url.includes('/api/v1/statuses') && typeof obj.uri === 'string') {
                                // https://docs.joinmastodon.org/methods/statuses/
                                // https://docs.joinmastodon.org/entities/status/
                                // uri = URI of the status used for federation (i.e. the AP url)
                                url = obj.uri;
                                const { response: response2, side: side2 } = await localOrRemoteFetchFunction(url, fetchers, computeUseSide(url), sleepMillisBetweenCalls); 
                                response = response2.clone();
                                obj = await response2.json();
                                side = side2;
                                console.log(JSON.stringify(obj, undefined, 2));
                            }
                            if (side === 'remote') {
                                const origin = new URL(url).origin;
                                if (!remoteOnlyOrigins.has(origin)) {
                                    addMessage('warning', `Local fetch failed (CORS disabled?)`, { url, tag: 'cors' });
                                    remoteOnlyOrigins.add(origin);
                                }
                            }
                            activityPubCalls++;
                            return response;
                        };
                        const start = Date.now();
                        const callbacks: Callbacks = {
                            onEvent: event => {
                                if (event.kind === 'warning') {
                                    const { message, url} = event;
                                    addMessage('warning', message, { url });
                                } else if (event.kind === 'node-processed') {
                                    job.commentsResults = [...results, { threadcap, subject: activityPub!.subject }];
                                    this.onChange();
                                } else {
                                    console.log('callbacks.event', event);
                                }
                            }
                        };
                        const fetcher = makeRateLimitedFetcher(fetchActivityPubOrMastodon, { callbacks });
                        const cache = new InMemoryCache();
                        const userAgent = this.threadcapUserAgent;
                    
                        const threadcap = await makeThreadcap(activityPub.url, { userAgent, fetcher, cache });
                        job.commentsResults = [...results, { threadcap, subject: activityPub!.subject }];
                        this.onChange();
                        
                        const updateTime = new Date().toISOString();
                        await updateThreadcap(threadcap, { updateTime, keepGoing, userAgent, fetcher, cache, callbacks });
                        // console.log(JSON.stringify(threadcap, undefined, 2));
                        job.times.commentsTime = Date.now() - start;
                        addMessage('info', `Found ${unitString(Object.values(threadcap.nodes).filter(v => v.comment).length, 'comment')} and ${unitString(Object.keys(threadcap.commenters).length, 'participant')}, made ${unitString(activityPubCalls, 'ActivityPub call')}`);

                        job.commentsResults = [...results, { threadcap, subject: activityPub!.subject }];
                        this.onChange();
                        results.push({ threadcap, subject: activityPub!.subject });
                    }

                    if (lightningComments) {
                        const sleepMillisBetweenCalls = 0;
                        setStatus(`Validating Lightning Comments for ${lightningComments.subject}`, { url: lightningComments.url });
                        addMessage('info', 'Fetching Lightning comments', { url: lightningComments.url });
                        const keepGoing = () => !job.done;
                        const remoteOnlyOrigins = new Set<string>();
                        const computeUseSide = (url: string) => {
                            return remoteOnlyOrigins.has(new URL(url).origin) ? 'remote' : undefined;
                        };
                        let lightningCommentsCalls = 0;
                        const fetchLightningComments = async (url: string) => {
                            const { response, side } = await localOrRemoteFetchJson(url, fetchers, computeUseSide(url), sleepMillisBetweenCalls); 
                            const obj = await response.clone().json();
                            console.log(JSON.stringify(obj, undefined, 2));
                            if (side === 'remote') {
                                const origin = new URL(url).origin;
                                if (!remoteOnlyOrigins.has(origin)) {
                                    addMessage('warning', `Local json fetch failed (CORS disabled?)`, { url, tag: 'cors' });
                                    remoteOnlyOrigins.add(origin);
                                }
                            }
                            lightningCommentsCalls++;
                            return response;
                        };
                        const start = Date.now();
                        const callbacks: Callbacks = {
                            onEvent: event => {
                                if (event.kind === 'warning') {
                                    const { message, url} = event;
                                    addMessage('warning', message, { url });
                                } else if (event.kind === 'node-processed') {
                                    job.commentsResults = [...results, { threadcap, subject: lightningComments!.subject }];
                                    this.onChange();
                                } else {
                                    console.log('callbacks.event', event);
                                }
                            }
                        };
                        const fetcher = makeRateLimitedFetcher(fetchLightningComments, { callbacks });
                        const cache = new InMemoryCache();
                        const userAgent = this.threadcapUserAgent;
                    
                        const threadcap = await makeThreadcap(lightningComments.url, { userAgent, fetcher, cache, protocol: 'lightningcomments' });
                        job.commentsResults = [...results, { threadcap, subject: lightningComments!.subject }];
                        this.onChange();
                        
                        const updateTime = new Date().toISOString();
                        await updateThreadcap(threadcap, { updateTime, keepGoing, userAgent, fetcher, cache, callbacks });
                        // console.log(JSON.stringify(threadcap, undefined, 2));
                        job.times.commentsTime = Date.now() - start;
                        addMessage('info', `Found ${unitString(Object.values(threadcap.nodes).filter(v => v.comment).length, 'comment')} and ${unitString(Object.keys(threadcap.commenters).length, 'participant')}, made ${unitString(lightningCommentsCalls, 'Lightning Comments call')}`);

                        job.commentsResults = [...results, { threadcap, subject: lightningComments!.subject }];
                        this.onChange();
                        results.push({ threadcap, subject: lightningComments!.subject });
                    }

                    if (twitter) {
                        const sleepMillisBetweenCalls = 0;
                        setStatus(`Validating Twitter Comments for ${twitter.subject}`, { url: twitter.url });
                        addMessage('info', 'Fetching Twitter comments', { url: twitter.url });
                        const keepGoing = () => !job.done;
                        let twitterCommentsCalls = 0;
                        const fetchTwitterComments = async (url: string) => {
                            const { response } = await localOrRemoteFetchJson(url, fetchers, 'remote', sleepMillisBetweenCalls); 
                            twitterCommentsCalls++;
                            return response;
                        };
                        const start = Date.now();
                        const callbacks: Callbacks = {
                            onEvent: event => {
                                if (event.kind === 'warning') {
                                    const { message, url} = event;
                                    addMessage('warning', message, { url });
                                } else if (event.kind === 'node-processed') {
                                    job.commentsResults = [...results, { threadcap, subject: twitter!.subject }];
                                    this.onChange();
                                } else {
                                    console.log('callbacks.event', event);
                                }
                            }
                        };
                        const fetcher = makeRateLimitedFetcher(fetchTwitterComments, { callbacks });
                        const cache = new InMemoryCache();
                        const userAgent = this.threadcapUserAgent;
                    
                        const threadcap = await makeThreadcap(twitter.url, { userAgent, fetcher, cache, protocol: 'twitter' });
                        job.commentsResults = [...results, { threadcap, subject: twitter!.subject }];
                        this.onChange();
                        
                        const updateTime = new Date().toISOString();
                        await updateThreadcap(threadcap, { updateTime, keepGoing, userAgent, fetcher, cache, callbacks });
                        // console.log(JSON.stringify(threadcap, undefined, 2));
                        job.times.commentsTime = Date.now() - start;
                        addMessage('info', `Found ${unitString(Object.values(threadcap.nodes).filter(v => v.comment).length, 'comment')} and ${unitString(Object.keys(threadcap.commenters).length, 'participant')}, made ${unitString(twitterCommentsCalls, 'Twitter Comments call')}`);

                        job.commentsResults = [...results, { threadcap, subject: twitter!.subject }];
                        this.onChange();
                        results.push({ threadcap, subject: twitter!.subject });
                    }
                   
                }
            } else {
                // not an url, do a search instead
                job.search = true;
                setStatus('Searching');
                const searchResponse = await piSearchFetcher(input, headers);
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
            addMessage('info', `${job.search ? 'Search took' : 'Took'} ${formatTime(Date.now() - jobStart)}${computeJobTimesStringSuffix(job.times)}`);
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
    readonly userAgent: string;
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

export type Fetcher = (url: string, headers?: Record<string, string>) => Promise<Response>;
export type PISearchFetcher = (input: string, headers: Record<string, string>) => Promise<Response>;

export interface ValidationJobTimes {
    fetchTime?: number;
    readTime?: number;
    parseTime?: number;
    validateTime?: number;
    commentsTime?: number;
}

export type FetchSide = 'local' | 'remote';

export interface FetchResult {
    readonly fetchTime: number;
    readonly side: FetchSide;
    readonly response: Response;
}

export interface CommentsResult {
    readonly threadcap: Threadcap;
    readonly subject: string;
}

//

function formatTime(millis: number): string {
    if (millis < 1000) return `${millis}ms`;
    return `${Math.round(millis / 1000 * 100) / 100}s`;
}

function computeJobTimesStringSuffix(times: ValidationJobTimes): string {
    const rt = [['fetch', times.fetchTime],['read', times.readTime],['parse', times.parseTime],['validate', times.validateTime],['comments', times.commentsTime]]
        .filter(v => v[1] !== undefined)
        .map(v => `${v[0]}=${formatTime(v[1] as number)}`)
        .join(', ');
    return rt === '' ? '' : ` (${rt})`;
}

function formatBytes(bytes: number): string {
    let amount = bytes;
    if (amount < 1024) return `${amount}-byte`;
    amount = amount / 1024;
    if (amount < 1024) return `${Math.round(amount * 100) / 100}kb`;
    amount = amount / 1024;
    return `${Math.round(amount * 100) / 100}mb`;
}

function unitString(amount: number, unit: string): string {
    return `${amount === 0 ? 'no' : amount === 1 ? 'one' : new Intl.NumberFormat().format(amount)} ${unit}${amount === 1 ? '' : 's'}`;
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

async function localOrRemoteFetchActivityPub(url: string, fetchers: Fetchers, useSide: FetchSide | undefined, sleepMillisBetweenCalls: number): Promise<{ response: Response, side: FetchSide }> {
    if (sleepMillisBetweenCalls > 0) await sleep(sleepMillisBetweenCalls);
    const { response, side } = await localOrRemoteFetch(url, { fetchers, headers: { 'Accept': 'application/activity+json' }, useSide });
    checkEqual('res.status', response.status, 200);
    console.log([...response.headers].map(v => v.join(': ')));
    const contentType = response.headers.get('Content-Type');
    if (!(contentType || '').includes('json')) { // application/activity+json; charset=utf-8, application/json
        throw new Error('Found html, not ActivityPub');
    }
    return { response, side };
}

async function localOrRemoteFetchJson(url: string, fetchers: Fetchers, useSide: FetchSide | undefined, sleepMillisBetweenCalls: number): Promise<{ response: Response, side: FetchSide }> {
    if (sleepMillisBetweenCalls > 0) await sleep(sleepMillisBetweenCalls);
    const { response, side } = await localOrRemoteFetch(url, { fetchers, headers: { 'Accept': 'application/json' }, useSide });
    checkEqual('res.status', response.status, 200);
    console.log([...response.headers].map(v => v.join(': ')));
    const contentType = response.headers.get('Content-Type');
    if (!(contentType || '').includes('json')) { // application/activity+json; charset=utf-8, application/json
        throw new Error('Found html, not json');
    }
    return { response, side };
}

async function localOrRemoteFetch(url: string, opts: { fetchers: Fetchers, headers?: Record<string, string>, useSide?: FetchSide }): Promise<FetchResult> {
    const { fetchers, headers, useSide } = opts;
    if (useSide !== 'remote') {
        try {
            console.log(`local fetch: ${url}`);
            const start = Date.now();
            const response = await fetchers.localFetcher(url, headers);
            return { fetchTime: Date.now() - start, side: 'local', response };
        } catch (e) {
            console.log('Failed to local fetch, trying remote', e);
        }
    }
    console.log(`remote fetch: ${url}`);
    const start = Date.now();
    const response = await fetchers.remoteFetcher(url, headers);
    return { fetchTime: Date.now() - start, side: 'remote', response };
}

function findEpisodeTitle(socialInteract: ExtendedXmlNode): string | undefined {
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

interface ValidationJob {
    readonly id: number;
    readonly messages: Message[]; // first message is status
    readonly searchResults: PIFeedInfo[];
    readonly options: ValidationOptions;
    readonly times: ValidationJobTimes;
    search: boolean;
    done: boolean;
    cancelled: boolean;
    xml?: ExtendedXmlNode;
    xmlSummaryText?: string;
    commentsResults?: CommentsResult[];
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

interface Fetchers {
    readonly localFetcher: Fetcher;
    readonly remoteFetcher: Fetcher;
}
