import { CollectionPage, Link, Note, Object_, Person, Image, OrderedCollection, OrderedCollectionPage, PodcastEpisode } from './activity_pub.ts';
import { Comment, Commenter, Attachment, Icon } from './comment_model.ts';
import { isReadonlyArray } from './util.ts';

export interface FetchCommentsOpts {
    keepGoing(): boolean;
    fetchActivityPub(url: string): Promise<Record<string, unknown> | undefined>;
    warn(comment: Comment, url: string, message: string): void;
    // deno-lint-ignore no-explicit-any
    readonly obj?: any;
}

export interface FetchCommentsResult {
    readonly subject: string;
    readonly rootComment: Comment;
    readonly commenters: ReadonlyMap<string, Commenter>; // attributedTo -> Commenter
}

//

export async function fetchCommentsForUrl(url: string, subject: string, opts: FetchCommentsOpts): Promise<FetchCommentsResult | undefined> {
    const rootComment = await fetchCommentsForUrl_(url, opts);
    if (!rootComment) return undefined;
    const commenters = await collectCommenters(rootComment, opts);
    return { subject, rootComment, commenters };
}

export function computeCommentCount(comment: Comment): number {
    return 1 + comment.replies.map(computeCommentCount).reduce((a, b) => a + b, 0);
}

//

async function fetchCommentsForUrl_(url: string, opts: FetchCommentsOpts): Promise<Comment | undefined> {
    const { fetchActivityPub } = opts;
    const obj = opts.obj || await fetchActivityPub(url); if (!obj) return undefined;
    if (obj.type === 'OrderedCollection') {
        const emptyComment: Comment = { content: '(OrderedCollection)', replies: [], attachments: [] };
        const orderedCollection = obj as unknown as OrderedCollection; // TODO validate
        await collectCommentsFromOrderedCollection(orderedCollection, emptyComment, opts, new Set());
        return emptyComment;
    }
    const noteOrPodcastEpisode = obj as unknown as Note | PodcastEpisode; // TODO validate
    const rootComment = initCommentFromObjectOrLink(noteOrPodcastEpisode);
    await collectComments(noteOrPodcastEpisode, rootComment, opts, url);
    return rootComment;
}

async function collectCommentsFromOrderedCollection(orderedCollection: OrderedCollection, comment: Comment, opts: FetchCommentsOpts, fetched: Set<string>) {
    if ((orderedCollection.items?.length || 0) > 0 || (orderedCollection.orderedItems?.length || 0) > 0) {
        throw new Error(`TODO: orderedCollection.items/orderedItems not implemented ${JSON.stringify(orderedCollection)}`);
    }
    if (orderedCollection.first === undefined && orderedCollection.totalItems === 0) {
        // fine, empty
    } else if (typeof orderedCollection.first === 'string') {
        await fetchPages(orderedCollection.first, comment, opts, fetched);
    } else {
        throw new Error(`TODO: orderedCollection.first not implemented ${JSON.stringify(orderedCollection)}`);
    }
}

async function collectComments(note: Note | PodcastEpisode, comment: Comment, opts: FetchCommentsOpts, url: string): Promise<void> {
    const { keepGoing, fetchActivityPub } = opts;
    const fetched = new Set<string>();
    const podcastEpisodeComments = note.type === 'PodcastEpisode' ? note.comments : note.replies;
    if (podcastEpisodeComments) {
        if (typeof podcastEpisodeComments === 'string') {
            const url = podcastEpisodeComments;
            const obj = await fetchActivityPub(url); if (!keepGoing()) return;
            if (!obj) return;
            fetched.add(url);
            console.log(JSON.stringify(obj, undefined, 2));
            if (obj.type === 'OrderedCollection') {
                const orderedCollection = obj as unknown as OrderedCollection;
                await collectCommentsFromOrderedCollection(orderedCollection, comment, opts, fetched);
            } else {
                throw new Error(`TODO: obj.type not implemented ${JSON.stringify(obj)}`);
            }
        } else if (podcastEpisodeComments.first) {
            if (typeof podcastEpisodeComments.first === 'object' && podcastEpisodeComments.first.type === 'CollectionPage') {
                if (podcastEpisodeComments.first.items && podcastEpisodeComments.first.items.length > 0) {
                    await collectItems(podcastEpisodeComments.first.items, comment, opts, url); if (!keepGoing()) return;
                }
                if (podcastEpisodeComments.first.next) {
                    if (typeof podcastEpisodeComments.first.next === 'string') {
                        await fetchPages(podcastEpisodeComments.first.next, comment, opts, fetched);
                    } else {
                        throw new Error(`TODO: first.next not implemented ${podcastEpisodeComments.first.next}`);
                    }
                }
            } else {
                throw new Error(`TODO: first type not implemented ${podcastEpisodeComments.first}`);
            }
        } else if (Array.isArray(podcastEpisodeComments)) {
            // Pleroma: found invalid  "replies": [], "replies_count": 0, on an object resulting from an AP c2s Create Activity
            if (podcastEpisodeComments.length > 0) {
                throw new Error(`TODO: non-standard podcastEpisodeComments array not empty`);
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
    if (object.type === 'Note') {
        const { attributedTo, content, published } = object;
        const url = object.url === null ? undefined : object.url;
        if (typeof attributedTo !== 'string') throw new Error(`TODO: Note.attributedTo type not implemented ${JSON.stringify(object)}`);
        if (typeof content !== 'string') throw new Error(`TODO: Note.content type not implemented ${typeof content} ${JSON.stringify(object)}`);
        if (typeof published !== 'string') throw new Error(`TODO: Note.published type not implemented ${JSON.stringify(object)}`);
        if (url !== undefined && typeof url !== 'string') throw new Error(`TODO: Note.url type not implemented ${JSON.stringify(object)}`);
        const attachments = computeAttachments(object);
        return { url, attributedTo, content, published, replies: [], attachments };
    }
    if (object.type === 'PodcastEpisode') {
        const podcastEpisode = object as PodcastEpisode;
        const { attributedTo, published, description, image } = podcastEpisode;
        if (typeof attributedTo !== 'string') throw new Error(`TODO: PodcastEpisode.attributedTo type not implemented ${JSON.stringify(object)}`);
        if (typeof published !== 'string') throw new Error(`TODO: PodcastEpisode.published type not implemented ${JSON.stringify(object)}`);
        if (typeof description !== 'object' || description.type !== 'Note') throw new Error(`TODO: PodcastEpisode.description type not implemented ${JSON.stringify(object)}`);
        const { content } = description;
        if (typeof content !== 'string') throw new Error(`TODO: PodcastEpisode.content type not implemented ${typeof content} ${JSON.stringify(object)}`);
        const url = undefined;
        const attachments = image ? [ computeAttachment(image) ] : [];
        return { url, attributedTo, content, published, replies: [], attachments };
    }
    throw new Error(`TODO: item type not implemented ${JSON.stringify(object)}`);
}

//

function computeAttachments(object: Object_): Attachment[] {
    const rt: Attachment[] = [];
    if (!object.attachment) return rt;
    const attachments = isReadonlyArray(object.attachment) ? object.attachment : [ object.attachment ];
    for (const attachment of attachments) {
        rt.push(computeAttachment(attachment));
    }
    return rt;
}

function computeAttachment(object: string | Link | Object_): Attachment {
    if (typeof object !== 'object' || (object.type !== 'Document' && object.type !== 'Image')) throw new Error(`TODO: attachment type not implemented ${JSON.stringify(object)}`);
    const { mediaType, width, height, url } = object;
    if (typeof mediaType !== 'string') throw new Error(`TODO: mediaType type not implemented ${JSON.stringify(object)}`);
    if (width !== undefined && typeof width !== 'number') throw new Error(`TODO: width type not implemented ${JSON.stringify(object)}`);
    if (height !== undefined && typeof height !== 'number') throw new Error(`TODO: height type not implemented ${JSON.stringify(object)}`);
    if (typeof url !== 'string') throw new Error(`TODO: url type not implemented ${JSON.stringify(object)}`);
    return { mediaType, width, height, url};
}

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
    let icon: Icon | undefined;
    if (person.icon) {
        if (typeof person.icon !== 'object' || isReadonlyArray(person.icon) || person.icon.type !== 'Image') throw new Error(`TODO person.icon not implemented: ${JSON.stringify(person.icon)}`);
        icon = computeIcon(person.icon);
    }
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
    if (comment.attributedTo) attributedTos.add(comment.attributedTo);
    for (const reply of comment.replies) {
        collectAttributedTos(reply, attributedTos);
    }
}
