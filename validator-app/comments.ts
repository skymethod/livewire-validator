import { CollectionPage, Link, Note, Object_, Person, Image } from './activity_pub.ts';
import { checkMatchesReturnMatcher } from './check.ts';

export interface Comment {
    readonly attributedTo: string;
    readonly content: string;
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
    readonly mediaType: string;
}

export interface FetchCommentsOpts {
    keepGoing(): boolean;
    fetchActivityPub(url: string): Promise<Record<string, unknown> | undefined>;
}

export interface FetchCommentsResult {
    readonly rootComment: Comment;
    readonly commenters: ReadonlyMap<string, Commenter>;
}

//

export async function fetchCommentsForUrl(url: string, opts: FetchCommentsOpts): Promise<FetchCommentsResult | undefined> {
    const rootComment = await fetchCommentsForUrl_(url, opts);
    if (!rootComment) return undefined;
    const commenters = await collectCommenters(rootComment, opts);
    return { rootComment, commenters };
}

//

async function fetchCommentsForUrl_(url: string, opts: FetchCommentsOpts): Promise<Comment | undefined> {
    const { fetchActivityPub } = opts;
    const obj = await fetchActivityPub(url); if (!obj) return undefined;
    const note = obj as unknown as Note; // TODO validate
    const rootComment = initCommentFromObjectOrLink(note);
    await collectComments(note, rootComment, opts);
    return rootComment;
}

async function collectComments(note: Note, comment: Comment, opts: FetchCommentsOpts): Promise<void> {
    const { keepGoing, fetchActivityPub } = opts;
    const fetched = new Set<string>();
    if (note.replies) {
        if (note.replies.first) {
            if (typeof note.replies.first === 'object' && note.replies.first.type === 'CollectionPage') {
                if (note.replies.first.items && note.replies.first.items.length > 0) {
                    await collectItems(note.replies.first.items, comment, opts); if (!keepGoing()) return;
                }
                if (note.replies.first.next) {
                    if (typeof note.replies.first.next === 'string') {
                        const url = note.replies.first.next;
                        let obj = await fetchActivityPub(url); if (!keepGoing()) return;
                        fetched.add(url);
                        console.log(JSON.stringify(obj, undefined, 2));
                        let keepCollecting = true;
                        while (keepCollecting) {
                            const page = obj as unknown as CollectionPage; // TODO validate
                            if (page.items) {
                                await collectItems(page.items, comment, opts); if (!keepGoing()) return;
                            }
                            if ((page.items?.length || 0) === 0) keepCollecting = false;
                            if (page.next) {
                                if (typeof page.next === 'string') {
                                    if (fetched.has(page.next)) {
                                        keepCollecting = false;
                                    } else {
                                        obj = await fetchActivityPub(page.next); if (!keepGoing()) return;
                                        fetched.add(url);
                                    }
                                } else {
                                    throw new Error(`TODO: page.next not implemented ${page.next}`);
                                }
                            } else {
                                keepCollecting = false;
                            }
                        }
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

async function collectItems(items: readonly (string | Link | Object_)[], comment: Comment, opts: FetchCommentsOpts) {
    for (const item of items) {
        if (typeof item === 'string') {
            // it's a link to another AP entity
            const reply = await fetchCommentsForUrl_(item, opts);
            if (reply) {
                comment.replies.push(reply);
            }
        } else {
            const reply = initCommentFromObjectOrLink(item);
            comment.replies.push(reply);
            await collectComments(item as Note, reply, opts);
        }
    }
}

function initCommentFromObjectOrLink(object: Object_ | Link): Comment {
    if (object.type !== 'Note') throw new Error(`TODO: item type not implemented ${JSON.stringify(object)}`);
    const { attributedTo, content } = object;
    if (typeof attributedTo !== 'string') throw new Error(`TODO: attributedTo type not implemented ${object}`);
    if (typeof content !== 'string') throw new Error(`TODO: content type not implemented ${object}`);
    return { attributedTo, content, replies: [] };
}

//

async function collectCommenters(comment: Comment, opts: FetchCommentsOpts): Promise<ReadonlyMap<string,Commenter>> {
    const attributedTos = new Set<string>();
    collectAttributedTos(comment, attributedTos);
    const rt = new Map<string, Commenter>();
    for (const attributedTo of attributedTos) {
        const commenter = await fetchCommenter(attributedTo, opts);
        rt.set(attributedTo, commenter)
    }
    return rt;
}

async function fetchCommenter(url: string, opts: FetchCommentsOpts): Promise<Commenter> {
    const obj = await opts.fetchActivityPub(url);
    const person = obj as unknown as Person; // TODO validate
    return computeCommenter(person);
}

function computeCommenter(person: Person): Commenter {
    if (typeof person.icon !== 'object' || isReadonlyArray(person.icon) || person.icon.type !== 'Image') throw new Error(`TODO person.icon not implemented: ${person.icon}`);
    const icon = computeIcon(person.icon);
    const { name, url } = person;
    if (typeof name !== 'string') throw new Error(`TODO person.name not implemented: ${name}`);
    if (typeof url !== 'string') throw new Error(`TODO person.url not implemented: ${url}`);
    const fqUsername = computeFqUsername(url);
    return { icon, name, url, fqUsername };
}

function computeIcon(icon: Image): Icon {
    const { url, mediaType } = icon;
    if (typeof url !== 'string') throw new Error(`TODO icon.url not implemented: ${url}`);
    if (typeof mediaType !== 'string') throw new Error(`TODO icon.mediaType not implemented: ${mediaType}`);
    return { url, mediaType };
}

function computeFqUsername(url: string): string {
    // https://example.org/@user -> @user@example.org
    const u = new URL(url);
    const m = checkMatchesReturnMatcher('url.pathname', u.pathname, /^\/(@[^\/]+)$/);
    return `${m[1]}@${u.hostname}`;
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
