import { Qname } from './deps_xml.ts';

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

const ITUNES_NAMESPACE = 'http://www.itunes.com/dtds/podcast-1.0.dtd';

function _itunes(name: string): Qname {
    return { name, namespaceUri: ITUNES_NAMESPACE };
}

//

export class Qnames {
    
    static readonly PodcastIndex = {
        NAMESPACES: PODCAST_INDEX_NAMESPACES as readonly string[],
        KNOWN_MISSPELLED_NAMESPACES: [ PODCAST_INDEX_NAMESPACE_KNOWN_MISSPELLING ] as readonly string[],
        get KNOWN_NAMES(): ReadonlySet<string> { return PODCAST_INDEX_KNOWN_NAMES },
        of: (name: string) => _podcastIndex(name, false /*known*/),
        alternateEnclosure: _podcastIndex('alternateEnclosure'),
        block: _podcastIndex('block'),
        chapters: _podcastIndex('chapters'),
        chat: _podcastIndex('chat'),
        complete: _podcastIndex('complete'),
        contentLink: _podcastIndex('contentLink'),
        episode: _podcastIndex('episode'),
        funding: _podcastIndex('funding'),
        guid: _podcastIndex('guid'),
        hiveAccount: _podcastIndex('hiveAccount'),
        images: _podcastIndex('images'),
        image: _podcastIndex('image'),
        integrity: _podcastIndex('integrity'),
        license: _podcastIndex('license'),
        liveItem: _podcastIndex('liveItem'),
        location: _podcastIndex('location'),
        locked: _podcastIndex('locked'),
        medium: _podcastIndex('medium'),
        person: _podcastIndex('person'),
        podping: _podcastIndex('podping'),
        podroll: _podcastIndex('podroll'),
        publisher: _podcastIndex('publisher'),
        remoteItem: _podcastIndex('remoteItem'),
        season: _podcastIndex('season'),
        social: _podcastIndex('social'),
        socialInteract: _podcastIndex('socialInteract'),
        socialSignUp: _podcastIndex('socialSignUp'),
        soundbite: _podcastIndex('soundbite'),
        source: _podcastIndex('source'),
        trailer: _podcastIndex('trailer'),
        transcript: _podcastIndex('transcript'),
        txt: _podcastIndex('txt'),
        updateFrequency: _podcastIndex('updateFrequency'),
        value: _podcastIndex('value'),
        valueRecipient: _podcastIndex('valueRecipient'),
        valueTimeSplit: _podcastIndex('valueTimeSplit'),
    }

    static readonly MediaRss = {
        NAMESPACE: MEDIA_RSS_NAMESPACE,
        of: (name: string) => _mediaRss(name),
        content: _mediaRss('content'),
    }

    static readonly Itunes = {
        NAMESPACE: ITUNES_NAMESPACE,
        of: (name: string) => _itunes(name),
        duration: _itunes('duration'),
        type: _itunes('type'),
    }

}
