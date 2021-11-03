import { CollectionPage, Link, Note, Object_, Person, Image, OrderedCollection, OrderedCollectionPage } from './activity_pub.ts';

export interface Comment {
    readonly attributedTo: string;
    readonly content: string;
    readonly published: string;
    readonly replies: Comment[];
}

export interface Commenter {
    readonly icon: Icon;
    readonly name: string;
    readonly url: string;
    readonly fqUsername: string; // e.g. @user@example.com
}

export interface Icon {
    readonly url: string;
    readonly mediaType?: string;
}

export interface FetchCommentsOpts {
    keepGoing(): boolean;
    fetchActivityPub(url: string): Promise<Record<string, unknown> | undefined>;
    warn(comment: Comment, url: string, message: string): void;
}

export interface FetchCommentsResult {
    readonly subject: string;
    readonly rootComment: Comment;
    readonly commenters: ReadonlyMap<string, Commenter>;
}

//

export async function fetchCommentsForUrl(url: string, subject: string, opts: FetchCommentsOpts): Promise<FetchCommentsResult | undefined> {
    const rootComment = await fetchCommentsForUrl_(url, opts);
    if (!rootComment) return undefined;
    const commenters = await collectCommenters(rootComment, opts);
    return { subject, rootComment, commenters };
}

//

async function fetchCommentsForUrl_(url: string, opts: FetchCommentsOpts): Promise<Comment | undefined> {
    const { fetchActivityPub } = opts;
    const obj = await fetchActivityPub(url); if (!obj) return undefined;
    const note = obj as unknown as Note; // TODO validate
    const rootComment = initCommentFromObjectOrLink(note);
    await collectComments(note, rootComment, opts, url);
    return rootComment;
}

async function collectComments(note: Note, comment: Comment, opts: FetchCommentsOpts, url: string): Promise<void> {
    const { keepGoing, fetchActivityPub } = opts;
    const fetched = new Set<string>();
    if (note.replies) {
        if (typeof note.replies === 'string') {
            const url = note.replies;
            const obj = await fetchActivityPub(url); if (!keepGoing()) return;
            if (!obj) return;
            fetched.add(url);
            console.log(JSON.stringify(obj, undefined, 2));
            if (obj.type === 'OrderedCollection') {
                const orderedCollection = obj as unknown as OrderedCollection;
                if ((orderedCollection.items?.length || 0) > 0 || (orderedCollection.orderedItems?.length || 0) > 0) {
                    throw new Error(`TODO: orderedCollection.items/orderedItems not implemented ${JSON.stringify(obj)}`);
                }
                if (orderedCollection.first === undefined && orderedCollection.totalItems === 0) {
                    // fine, empty
                } else if (typeof orderedCollection.first === 'string') {
                    await fetchPages(orderedCollection.first, comment, opts, fetched);
                } else {
                    throw new Error(`TODO: orderedCollection.first not implemented ${JSON.stringify(obj)}`);
                }
            } else {
                throw new Error(`TODO: obj.type not implemented ${JSON.stringify(obj)}`);
            }
        } else if (note.replies.first) {
            if (typeof note.replies.first === 'object' && note.replies.first.type === 'CollectionPage') {
                if (note.replies.first.items && note.replies.first.items.length > 0) {
                    await collectItems(note.replies.first.items, comment, opts, url); if (!keepGoing()) return;
                }
                if (note.replies.first.next) {
                    if (typeof note.replies.first.next === 'string') {
                        await fetchPages(note.replies.first.next, comment, opts, fetched);
                    } else {
                        throw new Error(`TODO: first.next not implemented ${note.replies.first.next}`);
                    }
                }
            } else {
                throw new Error(`TODO: first type not implemented ${note.replies.first}`);
            }
        } else {
            throw new Error(`TODO: first not found, implement items`);
        }
    }
}

async function fetchPages(url: string, comment: Comment, opts: FetchCommentsOpts, fetched: Set<string>) {
    const { fetchActivityPub, keepGoing } = opts;
    let obj = await fetchActivityPub(url); if (!keepGoing()) return;
    if (!obj) return;
    fetched.add(url);
    console.log(JSON.stringify(obj, undefined, 2));
    let keepCollecting = true;
    while (keepCollecting) {
        if (obj.type !== 'CollectionPage' && obj.type !== 'OrderedCollectionPage') {
            throw new Error(`TODO: page obj.type not implemented ${JSON.stringify(obj)}`);
        }
        const page: CollectionPage | OrderedCollectionPage = obj.type === 'CollectionPage' ? (obj as unknown as CollectionPage) : (obj as unknown as OrderedCollectionPage); // TODO validate
        if (page.items) {
            await collectItems(page.items, comment, opts, url); if (!keepGoing()) return;
        }
        if (page.type === 'OrderedCollectionPage' && page.orderedItems) {
            await collectItems(page.orderedItems, comment, opts, url); if (!keepGoing()) return;
        }
        if (page.next) {
            if (typeof page.next === 'string') {
                if (fetched.has(page.next)) {
                    keepCollecting = false;
                } else {
                    url = page.next;
                    obj = await fetchActivityPub(url); if (!keepGoing()) return;
                    if (!obj) return;
                    fetched.add(url);
                }
            } else {
                throw new Error(`TODO: page.next not implemented ${page.next}`);
            }
        } else {
            keepCollecting = false;
        }
    }
}

async function collectItems(items: readonly (string | Link | Object_)[], comment: Comment, opts: FetchCommentsOpts, url: string) {
    for (const item of items) {
        if (typeof item === 'string' && !item.startsWith('{')) {
            // it's a link to another AP entity
            const reply = await fetchCommentsForUrl_(item, opts);
            if (reply) {
                comment.replies.push(reply);
            }
        } else {
            const itemObj = typeof item === 'string' ? JSON.parse(item) : item;
            const reply = initCommentFromObjectOrLink(itemObj);
            comment.replies.push(reply);
            if (typeof item === 'string') {
                opts.warn(reply, url, 'Found item incorrectly double encoded as a json string');
            }
            await collectComments(item as Note, reply, opts, url);
        }
    }
}

function initCommentFromObjectOrLink(object: Object_ | Link): Comment {
    if (object.type !== 'Note') throw new Error(`TODO: item type not implemented ${JSON.stringify(object)}`);
    const { attributedTo, content, published } = object;
    if (typeof attributedTo !== 'string') throw new Error(`TODO: attributedTo type not implemented ${object}`);
    if (typeof content !== 'string') throw new Error(`TODO: content type not implemented ${object}`);
    if (typeof published !== 'string') throw new Error(`TODO: published type not implemented ${object}`);
    return { attributedTo, content, published, replies: [] };
}

//

async function collectCommenters(comment: Comment, opts: FetchCommentsOpts): Promise<ReadonlyMap<string,Commenter>> {
    const attributedTos = new Set<string>();
    collectAttributedTos(comment, attributedTos);
    const rt = new Map<string, Commenter>();
    for (const attributedTo of attributedTos) {
        const commenter = await fetchCommenter(attributedTo, opts);
        if (!commenter) return rt;
        rt.set(attributedTo, commenter)
    }
    return rt;
}

async function fetchCommenter(url: string, opts: FetchCommentsOpts): Promise<Commenter | undefined> {
    const obj = await opts.fetchActivityPub(url);
    if (!obj) return undefined;
    const person = obj as unknown as Person; // TODO validate
    return computeCommenter(person);
}

function computeCommenter(person: Person): Commenter {
    if (typeof person.icon !== 'object' || isReadonlyArray(person.icon) || person.icon.type !== 'Image') throw new Error(`TODO person.icon not implemented: ${person.icon}`);
    const icon = computeIcon(person.icon);
    const { name, url } = person;
    if (typeof name !== 'string') throw new Error(`TODO person.name not implemented: ${name}`);
    if (typeof url !== 'string') throw new Error(`TODO person.url not implemented: ${url}`);
    const fqUsername = computeFqUsername(url, person.preferredUsername);
    return { icon, name, url, fqUsername };
}

function computeIcon(icon: Image): Icon {
    const { url, mediaType } = icon;
    if (typeof url !== 'string') throw new Error(`TODO icon.url not implemented: ${url}`);
    if (mediaType !== undefined && typeof mediaType !== 'string') throw new Error(`TODO icon.mediaType not implemented: ${mediaType}`);
    return { url, mediaType };
}

function computeFqUsername(url: string, preferredUsername: string | undefined): string {
    // https://example.org/@user -> @user@example.org
    const u = new URL(url);
    const m = /^\/(@[^\/]+)$/.exec(u.pathname);
    const username = m ? m[1] : preferredUsername;
    if (!username) throw new Error(`Unable to compute username from url: ${url}`);
    return `${username}@${u.hostname}`;
}

function collectAttributedTos(comment: Comment, attributedTos: Set<string>) {
    attributedTos.add(comment.attributedTo);
    for (const reply of comment.replies) {
        collectAttributedTos(reply, attributedTos);
    }
}

// workaround for https://github.com/microsoft/TypeScript/issues/17002
// deno-lint-ignore no-explicit-any
function isReadonlyArray(arg: any): arg is readonly any[] {
    return Array.isArray(arg);
}
