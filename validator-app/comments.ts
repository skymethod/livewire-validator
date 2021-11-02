import { CollectionPage, Link, Note, Object_ } from './activity_pub.ts';

export interface Comment {
    readonly attributedTo: string;
    readonly content: string;
    readonly replies: Comment[];
}

export interface FetchOpts {
    keepGoing(): boolean;
    fetchActivityPub(url: string): Promise<Record<string, unknown> | undefined>;
}

export async function fetchCommentsForUrl(url: string, opts: FetchOpts): Promise<Comment | undefined> {
    const { fetchActivityPub } = opts;
    const obj = await fetchActivityPub(url); if (!obj) return undefined;
    const note = obj as unknown as Note; // TODO validate
    const rootComment = initCommentFromObjectOrLink(note);
    await collectComments(note, rootComment, opts);
    return rootComment;
}

//

async function collectComments(note: Note, comment: Comment, opts: FetchOpts): Promise<void> {
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

async function collectItems(items: readonly (string | Link | Object_)[], comment: Comment, opts: FetchOpts) {
    for (const item of items) {
        if (typeof item === 'string') {
            // it's a link to another AP entity
            const reply = await fetchCommentsForUrl(item, opts);
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
