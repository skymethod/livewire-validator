import { Qname } from './xml_parser.ts';

// https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md

const PODCAST_INDEX_NAMESPACE = 'https://podcastindex.org/namespace/1.0';
const PODCAST_INDEX_NAMESPACE_ALT = 'https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md';
const PODCAST_INDEX_NAMESPACE_KNOWN_MISSPELLING = 'https://podcastindex.org/namespace/1.0/';
const PODCAST_INDEX_NAMESPACES = [ PODCAST_INDEX_NAMESPACE, PODCAST_INDEX_NAMESPACE_ALT, PODCAST_INDEX_NAMESPACE_KNOWN_MISSPELLING ];

const PODCAST_INDEX_KNOWN_NAMES = new Set<string>();

function _podcastIndex(name: string, known = true): readonly Qname[] {
    if (known) PODCAST_INDEX_KNOWN_NAMES.add(name);
    return PODCAST_INDEX_NAMESPACES.map(v => ({ name, namespaceUri: v }));
}

// https://www.rssboard.org/media-rss

const MEDIA_RSS_NAMESPACE = 'http://search.yahoo.com/mrss/';

function _mediaRss(name: string): Qname {
    return { name, namespaceUri: MEDIA_RSS_NAMESPACE };
}

//

export class Qnames {
    
    static readonly PodcastIndex = {
        NAMESPACES: PODCAST_INDEX_NAMESPACES as readonly string[],
        KNOWN_MISSPELLED_NAMESPACES: [ PODCAST_INDEX_NAMESPACE_KNOWN_MISSPELLING ] as readonly string[],
        get KNOWN_NAMES(): ReadonlySet<string> { return PODCAST_INDEX_KNOWN_NAMES },
        of: (name: string) => _podcastIndex(name, false /*known*/),
        alternateEnclosure: _podcastIndex('alternateEnclosure'),
        chapters: _podcastIndex('chapters'),
        episode: _podcastIndex('episode'),
        funding: _podcastIndex('funding'),
        guid: _podcastIndex('guid'),
        hiveAccount: _podcastIndex('hiveAccount'),
        images: _podcastIndex('images'),
        integrity: _podcastIndex('integrity'),
        license: _podcastIndex('license'),
        location: _podcastIndex('location'),
        locked: _podcastIndex('locked'),
        medium: _podcastIndex('medium'),
        person: _podcastIndex('person'),
        podping: _podcastIndex('podping'),
        season: _podcastIndex('season'),
        social: _podcastIndex('social'),
        socialInteract: _podcastIndex('socialInteract'),
        socialSignUp: _podcastIndex('socialSignUp'),
        soundbite: _podcastIndex('soundbite'),
        source: _podcastIndex('source'),
        trailer: _podcastIndex('trailer'),
        transcript: _podcastIndex('transcript'),
        value: _podcastIndex('value'),
        valueRecipient: _podcastIndex('valueRecipient'),
    }

    static readonly MediaRss = {
        NAMESPACE: MEDIA_RSS_NAMESPACE,
        of: (name: string) => _mediaRss(name),
        content: _mediaRss('content'),
    }

}
