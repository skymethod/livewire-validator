import { Qname } from './xml_parser.ts';

// https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md

const PODCAST_INDEX_NAMESPACE = 'https://podcastindex.org/namespace/1.0';
const PODCAST_INDEX_NAMESPACE_ALT = 'https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md';
const PODCAST_INDEX_NAMESPACES = [ PODCAST_INDEX_NAMESPACE, PODCAST_INDEX_NAMESPACE_ALT ];

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
        NAMESPACES: PODCAST_INDEX_NAMESPACES,
        get KNOWN_NAMES(): ReadonlySet<string> { return PODCAST_INDEX_KNOWN_NAMES },
        of: (name: string) => _podcastIndex(name, false /*known*/),
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
        season: _podcastIndex('season'),
        episode: _podcastIndex('episode'),
        trailer: _podcastIndex('trailer'),
        license: _podcastIndex('license'),
        alternateEnclosure: _podcastIndex('alternateEnclosure'),
        integrity: _podcastIndex('integrity'),
        value: _podcastIndex('value'),
        valueRecipient: _podcastIndex('valueRecipient'),
    }

    static readonly MediaRss = {
        NAMESPACE: MEDIA_RSS_NAMESPACE,
        of: (name: string) => _mediaRss(name),
        content: _mediaRss('content'),
    }

}
