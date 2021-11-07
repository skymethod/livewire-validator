// https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md

const PODCAST_INDEX_NAMESPACE = 'https://podcastindex.org/namespace/1.0';
const PODCAST_INDEX_NAMESPACE_ALT = 'https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md';
const PODCAST_INDEX_NAMESPACES = [ PODCAST_INDEX_NAMESPACE, PODCAST_INDEX_NAMESPACE_ALT ];

function _podcastIndex(name: string): readonly Qname[] {
    return PODCAST_INDEX_NAMESPACES.map(v => ({ name, namespaceUri: v }));
}

// https://www.rssboard.org/media-rss

const MEDIA_RSS_NAMESPACE = 'http://search.yahoo.com/mrss/';

function _mediaRss(name: string): Qname {
    return { name, namespaceUri: MEDIA_RSS_NAMESPACE };
}

//

export interface Qname {
    readonly name: string;
    readonly namespaceUri?: string;
}

export class Qnames {

    static eq(lhs: Qname, rhs: Qname): boolean {
        return lhs.name === rhs.name && lhs.namespaceUri === rhs.namespaceUri;
    }

    static includes(lhs: readonly Qname[], rhs: Qname): boolean {
        return lhs.some(v => Qnames.eq(v, rhs));
    }

    static of(name: string): Qname {
        return { name };
    }

    //

    static readonly PodcastIndex = {
        NAMESPACES: PODCAST_INDEX_NAMESPACES,
        of: (name: string) => _podcastIndex(name),
        source: _podcastIndex('source'),
        socialInteract: _podcastIndex('socialInteract'),
        guid: _podcastIndex('guid'),
        locked: _podcastIndex('locked'),
        transcript: _podcastIndex('transcript'),
        funding: _podcastIndex('funding'),
        chapters: _podcastIndex('chapters'),
        soundbite: _podcastIndex('soundbite'),
        person: _podcastIndex('person'),
        location: _podcastIndex('location'),
    }

    static readonly MediaRss = {
        NAMESPACE: MEDIA_RSS_NAMESPACE,
        of: (name: string) => _mediaRss(name),
        content: _mediaRss('content'),
    }

}
