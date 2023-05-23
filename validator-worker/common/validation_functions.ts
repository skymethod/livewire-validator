export function isPodcastImagesSrcSet(trimmedText: string): boolean {
    // similar to html5 srcset, but relative urls are not allowed
    // https://html.spec.whatwg.org/multipage/images.html#srcset-attributes
    const widths = new Set<number>();
    const densities = new Set<number>();
    let withWidthCount = 0;
    const pieces = trimmedText.split(/,\s+/);
    for (const piece of pieces) {
        const m = /^([^\s]+)(\s+(\d+w|\d+(\.\d+)?x))?$/.exec(piece);
        if (!m) return false;
        const url = m[1];
        const descriptor = m[3] || '';
        if (!isUrl(url)) return false;

        if (descriptor.endsWith('w')) {
            withWidthCount++;
            const width = parseInt(descriptor.substring(0, descriptor.length - 1));
            if (width <= 0) return false;
            if (widths.has(width)) return false;
            widths.add(width);
        } else {
            const density = descriptor.endsWith('x') ? parseFloat(descriptor.substring(0, descriptor.length - 1)) : 1;
            if (density <= 0) return false;
            if (densities.has(density)) return false;
            densities.add(density);
        }
    }
    if (withWidthCount > 0 && withWidthCount !== pieces.length) return false;
    return true;
}

export function isNotEmpty(trimmedText: string): boolean {
    return trimmedText.length > 0;
}

export function isUrl(trimmedText: string): boolean {
    const u = tryParseUrl(trimmedText);
    return u?.protocol === 'https:' || u?.protocol === 'http:';
}

export function isHttpOrFileUrl(trimmedText: string): boolean {
    const u = tryParseUrl(trimmedText);
    return u?.protocol === 'https:' || u?.protocol === 'http:' || u?.protocol === 'file:';
}

export function isUri(trimmedText: string): boolean {
    return tryParseUrl(trimmedText) !== undefined;
}

export function isMimeType(trimmedText: string): boolean {
    return /^\w+\/[-+.\w]+$/.test(trimmedText);
}

export function isUuid(trimmedText: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(trimmedText);
}

export function isEmailAddress(trimmedText: string): boolean {
    return /^[^@\s]+@[^@\s]+$/.test(trimmedText);
}

export function isEmailAddressWithOptionalName(trimmedText: string): boolean {
    return /^[^@\s]+@[^@\s]+(\s+\(.*?\))?$/.test(trimmedText);
}

export function isAtMostCharacters(maxCharacters: number): (trimmedText: string) => boolean {
    return trimmedText => trimmedText.length <= maxCharacters;
}

export function isSeconds(trimmedText: string): boolean {
    return /^\d+(\.\d+)?$/.test(trimmedText);
}

export function isGeoLatLon(trimmedText: string): boolean {
    return /^geo:-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/.test(trimmedText);
}

export function isOpenStreetMapIdentifier(trimmedText: string): boolean {
    // https://github.com/Podcastindex-org/podcast-namespace/blob/main/location/location.md#osm-recommended
    return /^[NWR]\d+(#\d+)?$/.test(trimmedText);
}

export function isNonNegativeInteger(trimmedText: string): boolean {
    return /^\d+$/.test(trimmedText) 
        && parseInt(trimmedText) >= 0 
        && parseInt(trimmedText).toString() === trimmedText;
}

export function isPositiveInteger(trimmedText: string): boolean {
    return /^\d+$/.test(trimmedText) 
        && parseInt(trimmedText) > 0 
        && parseInt(trimmedText).toString() === trimmedText;
}

export function isDecimal(trimmedText: string): boolean {
    return /^\d+(\.\d+)?$/.test(trimmedText);
}

export function isRfc2822(trimmedText: string): boolean {
    // https://datatracker.ietf.org/doc/html/rfc2822
    // 01 Jun 2016 14:31:46 -0700
    // Thu, 01 Apr 2021 08:00:00 EST
    return /^[0-9A-Za-z, ]+ \d{2}:\d{2}(:\d{2})? ([-+]?[0-9]+|[A-Z]{3,})$/.test(trimmedText);
}

export function isIso8601AllowTimezone(trimmedText: string): boolean {
    return isIso8601(trimmedText, { allowTimezone: true });
}

export function isIso8601(trimmedText: string, opts: { allowTimezone?: boolean } = {}): boolean {
    const { allowTimezone } = opts;
    // 2021-04-14T10:25:42Z
    // 2022-04-25T01:30:00.000-0600
    const m =  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-](\d{2}|\d{4}|\d{2}:\d{2}))$/.exec(trimmedText);
    if (!m) return false;
    const tz = m[2];
    return allowTimezone || tz === 'Z';
}

export function isBoolean(trimmedText: string): boolean {
    return /^(true|false)$/.test(trimmedText);
}

export function isYesNo(trimmedText: string): boolean {
    return /^(yes|no)$/.test(trimmedText);
}

export function isPodcastValueTypeSlug(trimmedText: string): boolean {
    // https://github.com/Podcastindex-org/podcast-namespace/blob/main/value/valueslugs.txt
    return /^[a-z]+$/.test(trimmedText);
}

export function isPodcastMedium(trimmedText: string): boolean {
    // https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#medium
    return /^[a-z]+$/.test(trimmedText);
}

export function isPodcastSocialInteractProtocol(trimmedText: string): boolean {
    // https://github.com/Podcastindex-org/podcast-namespace/blob/main/socialprotocols.txt
    return /^(disabled|activitypub|twitter)$/.test(trimmedText);
}

export function isPodcastServiceSlug(trimmedText: string): boolean {
    // https://github.com/Podcastindex-org/podcast-namespace/blob/main/serviceslugs.txt
    return /^[a-z]{3,30}$/.test(trimmedText);
}

export function isPodcastLiveItemStatus(trimmedText: string): boolean {
    // https://github.com/Podcastindex-org/podcast-namespace/blob/main/socialprotocols.txt
    return /^(pending|live|ended)$/.test(trimmedText);
}

export function isRssLanguage(trimmedText: string): boolean {
    return /^[a-zA-Z]+(-[a-zA-Z]+)*$/.test(trimmedText);
}

export function isItunesDuration(trimmedText: string): boolean {
    // The duration of an episode.
    // Different duration formats are accepted however it is recommended to convert the length of the episode into seconds.
    return /^(\d+:)?\d+:\d+$/.test(trimmedText) || isNonNegativeInteger(trimmedText);
}

export function isItunesType(trimmedText: string): boolean {
    // The type of show
    // If your show is Serial you must use this tag.
    // episodic (default) or serial
    return /^(episodic|serial)$/.test(trimmedText);
}

export function hasApplePodcastsSupportedFileExtension(url: string): boolean {
    const u = tryParseUrl(url);
    return u !== undefined && /\.(m4a|mp3|mov|mp4|m4v|pdf)$/i.test(u.pathname);
}

//

function tryParseUrl(str: string, base?: string | URL | undefined): URL | undefined {
    try {
        return new URL(str, base);
    } catch {
        return undefined;
    }
}
