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
    return u && u.protocol === 'https:' || u?.protocol === 'http:';
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

export function isDecimal(trimmedText: string): boolean {
    return /^\d+(\.\d+)?$/.test(trimmedText);
}

export function isRfc2822(trimmedText: string): boolean {
    // https://datatracker.ietf.org/doc/html/rfc2822
    // 01 Jun 2016 14:31:46 -0700
    // Thu, 01 Apr 2021 08:00:00 EST
    return /^[0-9A-Za-z: -]+$/.test(trimmedText);
}

export function isIso8601(trimmedText: string): boolean {
    // 2021-04-14T10:25:42Z
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(trimmedText);
}

export function isBoolean(trimmedText: string): boolean {
    return /^(true|false)$/.test(trimmedText);
}

export function isPodcastValueTypeSlug(trimmedText: string): boolean {
    // https://github.com/Podcastindex-org/podcast-namespace/blob/main/value/valueslugs.txt
    return /^[a-z]+$/.test(trimmedText);
}

export function isPodcastMedium(trimmedText: string): boolean {
    // https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#medium
    return /^[a-z]+$/.test(trimmedText);
}

//

function tryParseUrl(str: string, base?: string | URL | undefined): URL | undefined {
    try {
        return new URL(str, base);
    } catch {
        return undefined;
    }
}