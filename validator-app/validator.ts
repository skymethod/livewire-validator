import { checkTrue } from './check.ts';
import { isAtMostCharacters, isBoolean, isDecimal, isEmailAddress, isGeoLatLon, isPodcastImagesSrcSet, isIso8601, isMimeType, isNonNegativeInteger, isNotEmpty, isOpenStreetMapIdentifier, isPodcastMedium, isPodcastValueTypeSlug, isRfc2822, isSeconds, isUri, isUrl, isUuid } from './deps_app.ts';
import { Qnames } from './qnames.ts';
import { ExtendedXmlNode, findChildElements, findElementRecursive, Qname } from './xml_parser.ts';

export function validateFeedXml(xml: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    if (xml.tagname !== '!xml') return callbacks.onError(xml, `Bad xml.tagname: ${xml.tagname}`);
    if (Object.keys(xml.attrsMap).length > 0) return callbacks.onError(xml, `Bad xml.attrsMap: ${xml.attrsMap}`);

    const docElement = Object.values(xml.child).flatMap(v => v)[0];
    if (!docElement) return callbacks.onError(xml, `No xml root element`); 
    validateRss(docElement as ExtendedXmlNode, callbacks);
}

export function podcastIndexReference(href: string): RuleReference {
    return { ruleset: 'podcastindex', href };
}

//

export interface MessageOptions {
    readonly tag?: string;
    readonly reference?: RuleReference
}

export interface ValidationCallbacks {
    onGood(node: ExtendedXmlNode, message: string, opts?: MessageOptions): void;
    onInfo(node: ExtendedXmlNode, message: string, opts?: MessageOptions): void;
    onError(node: ExtendedXmlNode, message: string, opts?: MessageOptions): void;
    onWarning(node: ExtendedXmlNode, message: string, opts?: MessageOptions): void;
    onPodcastIndexTagNamesFound(known: ReadonlySet<string>, unknown: ReadonlySet<string>, namespaceUris: ReadonlySet<string>): void;
    onRssItemsFound(itemsCount: number, itemsWithEnclosuresCount: number): void;
}

export interface RuleReference {
    readonly ruleset: string;
    readonly href: string;
}

//

function getSingleChild(node: ExtendedXmlNode, name: string, callbacks: ValidationCallbacks, opts: MessageOptions = {}): ExtendedXmlNode | undefined {
    const children = findChildElements(node, { name });
    if (children.length !== 1) {
        callbacks.onWarning(node, `Expected single <${name}> child element under <${node.tagname}>, found ${children.length === 0 ? 'none' : children.length}`, opts);
        return undefined;
    }
    return children[0] as ExtendedXmlNode;
}

function validateRss(rss: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    // rss required
    const opts: MessageOptions = { reference: { ruleset: 'rss', href: 'https://cyber.harvard.edu/rss/rss.html#whatIsRss' } };
    if (rss.tagname !== 'rss') return callbacks.onError(rss, `Bad xml root tag: ${rss.tagname}, expected rss`, opts);
    const version = rss.atts.get('version');
    if (version !== '2.0') callbacks.onWarning(rss, `Bad rss.version: ${version}, expected 2.0`, opts);

    // itunes required
    const itunesOpts: MessageOptions = { reference: { ruleset: 'itunes', href: 'https://podcasters.apple.com/support/823-podcast-requirements#:~:text=Podcast%20RSS%20feed%20technical%20requirements' } };
    const hasItunesPrefix = findElementRecursive(rss, v => v.tagname.startsWith('itunes:')) !== undefined;
    if (hasItunesPrefix) checkAttributeEqual(rss, 'xmlns:itunes', 'http://www.itunes.com/dtds/podcast-1.0.dtd', callbacks, itunesOpts);
    const hasContentPrefix = findElementRecursive(rss, v => v.tagname.startsWith('content:')) !== undefined;
    if (hasContentPrefix) checkAttributeEqual(rss, 'xmlns:content', 'http://purl.org/rss/1.0/modules/content/', callbacks, itunesOpts);

    // continue to channel
    const channel = getSingleChild(rss, 'channel', callbacks, opts); if (!channel) return;
    validateChannel(channel as ExtendedXmlNode, callbacks);
}

function validateChannel(channel: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    // rss required
    const opts: MessageOptions = { reference: { ruleset: 'rss', href: 'https://cyber.harvard.edu/rss/rss.html#requiredChannelElements' } };
    const title = getSingleChild(channel, 'title', callbacks, opts);
    checkText(title, isNotEmpty, callbacks, opts);
    const link = getSingleChild(channel, 'link', callbacks, opts);
    checkText(link, isUrl, callbacks, opts);
    const description = getSingleChild(channel, 'description', callbacks, opts);
    checkText(description, isNotEmpty, callbacks, opts);

    // podcast:guid
    ElementValidation.forSingleChild('channel', channel, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#guid'), ...Qnames.PodcastIndex.guid)
        .checkValue(isUuid, guidText => {
            const version = guidText.charAt(14);
            if (version !== '5') {
                return `expected a UUIDv5, found a UUIDv${version}`;
            }
        })
        .checkRemainingAttributes();

    // podcast:locked
    ElementValidation.forSingleChild('channel', channel, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#locked'), ...Qnames.PodcastIndex.locked)
        .checkValue(v => /^(yes|no)$/.test(v))
        .checkRequiredAttribute('owner', isEmailAddress)
        .checkRemainingAttributes();

    // podcast:funding
    for (const funding of findChildElements(channel, ...Qnames.PodcastIndex.funding)) {
        ElementValidation.forElement('channel', funding, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#funding'))
            .checkValue(isNotEmpty)
            .checkValue(isAtMostCharacters(128))
            .checkRequiredAttribute('url', isUrl)
            .checkRemainingAttributes();
    }

    // podcast:person
    checkPodcastPerson('channel', channel, callbacks);

    // podcast:location
    checkPodcastLocation('channel', channel, callbacks);

    // podcast:trailer
    for (const trailer of findChildElements(channel, ...Qnames.PodcastIndex.trailer)) {
        ElementValidation.forElement('channel', trailer, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#trailer'))
            .checkValue(isNotEmpty)
            .checkValue(isAtMostCharacters(128))
            .checkRequiredAttribute('url', isUrl)
            .checkRequiredAttribute('pubdate', isRfc2822)
            .checkOptionalAttribute('length', isNonNegativeInteger)
            .checkOptionalAttribute('type', isMimeType)
            .checkOptionalAttribute('season', isNonNegativeInteger)
            .checkRemainingAttributes();
    }

    // podcast:license
    checkPodcastLicense('channel', channel, callbacks);

    // podcast:value
    checkPodcastValue('channel', channel, callbacks);

    // podcast:medium
    ElementValidation.forSingleChild('channel', channel, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#medium'), ...Qnames.PodcastIndex.medium)
        .checkValue(isPodcastMedium)
        .checkRemainingAttributes();

    // podcast:images
    checkPodcastImages('channel', channel, callbacks);

    // PROPOSALS

    // podcast:social
    const socials = findChildElements(channel, ...Qnames.PodcastIndex.social);
    const socialReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/proposal-docs/social/social.md#social-element');
    const socialSignUpReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/proposal-docs/social/social.md#socialsignup-element');
    for (const social of socials) {
        ElementValidation.forElement('channel', social, callbacks, socialReference)
            .checkRequiredAttribute('platform', isNotEmpty)
            .checkRequiredAttribute('podcastAccountId', isNotEmpty)
            .checkRequiredAttribute('podcastAccountUrl', isUrl)
            .checkOptionalAttribute('priority', isNonNegativeInteger)
            .checkRemainingAttributes();
            
        const socialSignUps = findChildElements(channel, ...Qnames.PodcastIndex.socialSignUp);
        for (const socialSignUp of socialSignUps) {
            ElementValidation.forElement('social', socialSignUp, callbacks, socialSignUpReference)
                .checkRequiredAttribute('homeUrl', isUrl)
                .checkRequiredAttribute('signUpUrl', isUrl)
                .checkOptionalAttribute('priority', isNonNegativeInteger)
                .checkRemainingAttributes();
        }
    }
    const badSocialSignups = findChildElements(channel, ...Qnames.PodcastIndex.socialSignUp);
    if (badSocialSignups.length > 0) {
        callbacks.onWarning(badSocialSignups[0], `Bad <${badSocialSignups[0].tagname}>: should be a child of <podcast:social>, not channel`);
    }

    // podcast:podping
    const podpingReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/proposal-docs/podping/podping.md#specification');
    const podping = ElementValidation.forSingleChild('channel', channel, callbacks, podpingReference, ...Qnames.PodcastIndex.podping)
        .checkOptionalAttribute('usesPodping', isBoolean)
        .checkRemainingAttributes()
        .node;
    if (podping) {
        for (const hiveAccount of findChildElements(podping, ...Qnames.PodcastIndex.hiveAccount)) {
            ElementValidation.forElement('podping', hiveAccount, callbacks, podpingReference)
                .checkRequiredAttribute('account', isNotEmpty)
                .checkRemainingAttributes();
        }
    }

    checkPodcastTagUsage(channel, callbacks);

    // continue to items
    const items = channel.child.item || [];
    let itemsWithEnclosuresCount = 0;
    let itemsValidated = 0;
    for (const item of items) {
        if (itemsValidated < 1) { // just validate the first item for now
            validateItem(item as ExtendedXmlNode, callbacks);
            itemsValidated++;
        }
        const elements = findChildElements(item as ExtendedXmlNode, { name: 'enclosure' });
        if (elements.length > 0) itemsWithEnclosuresCount++;
    }
    callbacks.onRssItemsFound(items.length, itemsWithEnclosuresCount);
}

function checkPodcastPerson(level: Level, node: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    for (const person of findChildElements(node, ...Qnames.PodcastIndex.person)) {
        ElementValidation.forElement(level, person, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#person'))
            .checkValue(isNotEmpty)
            .checkValue(isAtMostCharacters(128))
            .checkOptionalAttribute('role', isNotEmpty)
            .checkOptionalAttribute('group', isNotEmpty)
            .checkOptionalAttribute('img', isUrl)
            .checkOptionalAttribute('href', isUrl)
            .checkRemainingAttributes();
    }
}

function checkPodcastLocation(level: Level, node: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    ElementValidation.forSingleChild(level, node, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#location'), ...Qnames.PodcastIndex.location)
        .checkOptionalAttribute('geo', isGeoLatLon)
        .checkOptionalAttribute('osm', isOpenStreetMapIdentifier)
        .checkValue(isNotEmpty)
        .checkValue(isAtMostCharacters(128))
        .checkRemainingAttributes();
}

function checkPodcastLicense(level: Level, node: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    ElementValidation.forSingleChild(level, node, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#license'), ...Qnames.PodcastIndex.license)
        .checkOptionalAttribute('url', isUrl)
        .checkValue(isNotEmpty)
        .checkValue(isAtMostCharacters(128))
        .checkRemainingAttributes();
}

function checkPodcastValue(level: Level, node: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    const value = ElementValidation.forSingleChild(level, node, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#value'), ...Qnames.PodcastIndex.value)
        .checkRequiredAttribute('type', isPodcastValueTypeSlug)
        .checkRequiredAttribute('method', isNotEmpty)
        .checkOptionalAttribute('suggested', isDecimal)
        .checkRemainingAttributes()
        .node;

    if (value) {
        for (const valueRecipient of findChildElements(value, ...Qnames.PodcastIndex.valueRecipient)) {
            ElementValidation.forElement('value', valueRecipient, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#value-recipient'))
                .checkOptionalAttribute('name', isNotEmpty)
                .checkOptionalAttribute('customKey', isNotEmpty)
                .checkOptionalAttribute('customValue', isNotEmpty)
                .checkRequiredAttribute('type', isPodcastValueTypeSlug)
                .checkRequiredAttribute('address', isNotEmpty)
                .checkRequiredAttribute('split', isNonNegativeInteger)
                .checkOptionalAttribute('fee', isBoolean)
                .checkRemainingAttributes();
        }
    }
}

function checkPodcastImages(level: Level, node: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    ElementValidation.forSingleChild(level, node, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#images'), ...Qnames.PodcastIndex.images)
        .checkRequiredAttribute('srcset', isPodcastImagesSrcSet)
        .checkRemainingAttributes();
}

function checkPodcastTagUsage(node: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    const known = new Set<string>();
    const unknown = new Set<string>();
    const namespaceUris = new Set<string>();
    for (const element of findChildElements(node, ...Qnames.PodcastIndex.NAMESPACES.map(v => ({ name: '*', namespaceUri: v })))) {
        const isKnown = Qnames.PodcastIndex.KNOWN_NAMES.has(element.qname.name);
        (isKnown ? known : unknown).add(element.qname.name);
        if (element.qname.namespaceUri) namespaceUris.add(element.qname.namespaceUri);
    }
    if (known.size + unknown.size > 0) {
        callbacks.onPodcastIndexTagNamesFound(known, unknown, namespaceUris);
    }
}

function checkAttributeEqual(node: ExtendedXmlNode, attName: string, attExpectedValue: string, callbacks: ValidationCallbacks, opts: MessageOptions = {}) {
    const attValue = node.atts.get(attName);
    if (!attValue) {
        callbacks.onWarning(node, `Missing <${node.tagname}> ${attName} attribute, expected ${attExpectedValue}`, opts);
    } else if (attValue !== attExpectedValue) {
        callbacks.onWarning(node, `Bad <${node.tagname}> ${attName} attribute value: ${attValue}, expected ${attExpectedValue}`, opts);
    }
}

function checkText(node: ExtendedXmlNode | undefined, test: (trimmedText: string) => boolean, callbacks: ValidationCallbacks, opts: MessageOptions = {}): string | undefined {
    if (node) {
        const trimmedText = (node.val || '').trim();
        if (!test(trimmedText)) {
            callbacks.onWarning(node, `Bad <${node.tagname}> value: ${trimmedText === '' ? '<empty>' : trimmedText}`, opts);
        }
        return trimmedText;
    }
    return undefined;
}

function findFirstChildElement(node: ExtendedXmlNode, qname: Qname, callbacks: ValidationCallbacks, opts: MessageOptions = {}): ExtendedXmlNode | undefined {
    const elements = findChildElements(node, qname);
    if (elements.length === 0) {
        callbacks.onWarning(node, `Item is missing an <${qname.name}> element`, opts);
    } else {
        if (elements.length > 1) callbacks.onWarning(node, `Item has multiple <${qname.name}> elements`, opts);
        return elements[0];
    }
    return undefined;
}

function validateItem(item: ExtendedXmlNode, callbacks: ValidationCallbacks) {

    const itunesOpts1: MessageOptions = { reference: { ruleset: 'itunes', href: 'https://podcasters.apple.com/support/823-podcast-requirements#:~:text=Podcast%20RSS%20feed%20technical%20requirements' } };
    const itunesOpts2: MessageOptions = { reference: { ruleset: 'itunes', href: 'https://help.apple.com/itc/podcasts_connect/#/itcb54353390' } };

    // title
    const title = findFirstChildElement(item, { name: 'title' }, callbacks, itunesOpts2);
    if (title) {
        checkText(title, isNotEmpty, callbacks, itunesOpts2);
    }

    // enclosure
    const enclosure = findFirstChildElement(item, { name: 'enclosure' }, callbacks, itunesOpts2);
    if (enclosure) {
        const rssEnclosureOpts: MessageOptions = { reference: { ruleset: 'rss', href: 'https://cyber.harvard.edu/rss/rss.html#ltenclosuregtSubelementOfLtitemgt' } };

        const url = enclosure.atts.get('url');
        if (!url) callbacks.onWarning(enclosure, `Missing item <enclosure> url attribute`, rssEnclosureOpts);
        if (url && !isUrl(url)) callbacks.onWarning(enclosure, `Bad item <enclosure> url attribute value: ${url}, expected url`, rssEnclosureOpts);

        const length = enclosure.atts.get('length');
        if (!length) callbacks.onWarning(enclosure, `Missing <enclosure> length attribute`, rssEnclosureOpts);
        if (length && !isNonNegativeInteger(length)) callbacks.onWarning(enclosure, `Bad item <enclosure> length attribute value: ${length}, expected non-negative integer`, rssEnclosureOpts);

        const type = enclosure.atts.get('type');
        if (!type) callbacks.onWarning(enclosure, `Missing <enclosure> type attribute`, rssEnclosureOpts);
        if (type && !isMimeType(type)) callbacks.onWarning(enclosure, `Bad item <enclosure> type attribute value: ${type}, expected MIME type`, rssEnclosureOpts);
    }

    // guid
    const guid = findFirstChildElement(item, { name: 'guid' }, callbacks, itunesOpts1);
    if (guid) {
        const guidText = checkText(guid, isNotEmpty, callbacks, itunesOpts1);

        const rssGuidOpts: MessageOptions = { reference: { ruleset: 'rss', href: 'https://cyber.harvard.edu/rss/rss.html#ltguidgtSubelementOfLtitemgt' } };

        const misspellings = [...guid.atts.keys()].filter(v => v !== 'isPermaLink' && v.toLowerCase() === 'ispermalink');
        for (const misspelling of misspellings) {
            callbacks.onWarning(guid, `Bad item <guid> isPermaLink attribute spelling: ${misspelling}`, rssGuidOpts);
        }
        const isPermaLink = guid.atts.get('isPermaLink') || 'true'; // default value is true!
        if (isPermaLink === 'true' && guidText && !isUrl(guidText) && misspellings.length === 0) callbacks.onWarning(guid, `Bad item <guid> value: ${guidText}, expected url when isPermaLink="true" or unspecified`, rssGuidOpts);
    }

    // podcast:transcript
    const transcripts = findChildElements(item, ...Qnames.PodcastIndex.transcript);
    for (const transcript of transcripts) {
        ElementValidation.forElement('item', transcript, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#transcript'))
            .checkRequiredAttribute('url', isUrl)
            .checkRequiredAttribute('type', isMimeType)
            .checkOptionalAttribute('language', isNotEmpty)
            .checkOptionalAttribute('rel', isNotEmpty)
            .checkRemainingAttributes();
    }

    // podcast:chapters
    ElementValidation.forSingleChild('item', item, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#chapters'), ...Qnames.PodcastIndex.chapters)
        .checkRequiredAttribute('url', isUrl)
        .checkRequiredAttribute('type', isMimeType)
        .checkRemainingAttributes();

    // podcast:soundbite
    const soundbites = findChildElements(item, ...Qnames.PodcastIndex.soundbite);
    for (const soundbite of soundbites) {
        ElementValidation.forElement('item', soundbite, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#soundbite'))
            .checkRequiredAttribute('startTime', isSeconds)
            .checkRequiredAttribute('duration', isSeconds)
            .checkValue(isAtMostCharacters(128))
            .checkRemainingAttributes();
    }
   
    // podcast:person
    checkPodcastPerson('item', item, callbacks);

    // podcast:location
    checkPodcastLocation('item', item, callbacks);

    // podcast:season
    ElementValidation.forSingleChild('item', item, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#season'), ...Qnames.PodcastIndex.season)
        .checkOptionalAttribute('name', v => isNotEmpty(v) && isAtMostCharacters(128)(v))
        .checkValue(isNonNegativeInteger)
        .checkRemainingAttributes();

    // podcast:episode
    ElementValidation.forSingleChild('item', item, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#episode'), ...Qnames.PodcastIndex.episode)
        .checkOptionalAttribute('display', v => isNotEmpty(v) && isAtMostCharacters(32)(v))
        .checkValue(isDecimal)
        .checkRemainingAttributes();

    // podcast:license
    checkPodcastLicense('item', item, callbacks);

    // podcast:alternateEnclosure
    const alternateEnclosures = findChildElements(item, ...Qnames.PodcastIndex.alternateEnclosure);
    for (const alternateEnclosure of alternateEnclosures) {
        ElementValidation.forElement('item', alternateEnclosure, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#alternate-enclosure'))
            .checkRequiredAttribute('type', isMimeType)
            .checkRequiredAttribute('length', isNonNegativeInteger)
            .checkOptionalAttribute('bitrate', isDecimal)
            .checkOptionalAttribute('height', isNonNegativeInteger)
            .checkOptionalAttribute('lang', isNotEmpty)
            .checkOptionalAttribute('title', v => isNotEmpty(v) && isAtMostCharacters(32)(v))
            .checkOptionalAttribute('rel', v => isNotEmpty(v) && isAtMostCharacters(32)(v))
            .checkOptionalAttribute('codecs', isNotEmpty)
            .checkOptionalAttribute('default', isBoolean)
            .checkRemainingAttributes();
        
        ElementValidation.forSingleChild('alternateEnclosure', alternateEnclosure, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#integrity'), ...Qnames.PodcastIndex.integrity)
            .checkRequiredAttribute('type', v => /^(sri|pgp-signature)$/.test(v))
            .checkRequiredAttribute('value', isNotEmpty)
            .checkRemainingAttributes();

        const sources = findChildElements(alternateEnclosure, ...Qnames.PodcastIndex.source);
        for (const source of sources) {
            ElementValidation.forElement('alternateEnclosure', source, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#alternate-enclosure'))
                .checkRequiredAttribute('uri', isUri)
                .checkOptionalAttribute('contentType', isMimeType)
                .checkRemainingAttributes();
        }
    }

    // podcast:value
    checkPodcastValue('item', item, callbacks);

    // podcast:images
    checkPodcastImages('item', item, callbacks);

    // PROPOSALS

    // podcast:socialInteract
    const socialInteracts = findChildElements(item, ...Qnames.PodcastIndex.socialInteract);
    const socialInteractReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/proposal-docs/social/social.md#socialinteract-element');
    for (const socialInteract of socialInteracts) {
        ElementValidation.forElement('item', socialInteract, callbacks, socialInteractReference)
            .checkRequiredAttribute('platform', isNotEmpty)
            .checkRequiredAttribute('podcastAccountId', isNotEmpty)
            .checkOptionalAttribute('pubDate', isIso8601)
            .checkOptionalAttribute('priority', isNonNegativeInteger)
            .checkValue(isUri)
            .checkRemainingAttributes();

        callbacks.onGood(socialInteract, 'Found <podcast:socialInteract>, nice!', { tag: 'social-interact', reference: socialInteractReference });
    }

    checkPodcastTagUsage(item, callbacks);
}

//

type Level = 'channel' | 'item' | string;

class ElementValidation {
    private static readonly EMPTY_STRING_SET = new Set<string>();

    readonly node?: ExtendedXmlNode;

    private readonly level: Level;
    private readonly callbacks: ValidationCallbacks;
    private readonly opts: MessageOptions;
    private readonly remainingAttNames: Set<string>;

    private constructor(level: Level, node: ExtendedXmlNode | undefined, callbacks: ValidationCallbacks, opts: MessageOptions) {
        this.level = level;
        this.node = node;
        this.callbacks = callbacks;
        this.opts = opts;
        this.remainingAttNames = node ? new Set(node.atts.keys()) : ElementValidation.EMPTY_STRING_SET;
    }

    static forElement(level: Level, node: ExtendedXmlNode, callbacks: ValidationCallbacks, reference: RuleReference): ElementValidation {
        return new ElementValidation(level, node, callbacks, { reference });
    }

    static forSingleChild(level: Level, parent: ExtendedXmlNode, callbacks: ValidationCallbacks, reference: RuleReference, ...qnames: Qname[]): ElementValidation {
        checkTrue('qnames.length', qnames.length, qnames.length > 0);
        const elements = findChildElements(parent, ...qnames);
        if (elements.length > 0) {
            if (elements.length > 1) callbacks.onWarning(elements[1], `Multiple ${level} <${elements[1].tagname}> elements are not allowed`, { reference });
            const element = elements[0];
            return new ElementValidation(level, element, callbacks, { reference });
        }
        return new ElementValidation(level, undefined, callbacks, { reference });
    }

    checkValue(test: (trimmedText: string) => boolean, additionalTest?: (trimmedText: string) => string | undefined): ElementValidation {
        const { node, callbacks, opts } = this;
        if (node) {
            const trimmedText = checkText(node, test, callbacks, opts);
            if (trimmedText && additionalTest) {
                const warningSuffix = additionalTest(trimmedText);
                if (warningSuffix) {
                    callbacks.onWarning(node, `Bad <${node.tagname}> value: ${trimmedText === '' ? '<empty>' : trimmedText}, ${warningSuffix}`, opts);
                }
            }
        }
        return this;
    }

    checkRequiredAttribute(name: string, test: (value: string) => boolean): ElementValidation {
        const { node, callbacks, opts, level } = this;
        if (node) {
            const value = node.atts.get(name);
            if (!value) callbacks.onWarning(node, `Missing ${level} <${node.tagname}> ${name} attribute`, opts);
            if (value && !test(value)) callbacks.onWarning(node, `Bad ${level} <${node.tagname}> ${name} attribute value: ${value}`, opts);
            this.remainingAttNames.delete(name);
        }
        return this;
    }

    checkOptionalAttribute(name: string, test: (value: string) => boolean): ElementValidation {
        const { node, callbacks, opts, level } = this;
        if (node) {
            const value = node.atts.get(name);
            if (value && !test(value)) callbacks.onWarning(node, `Bad ${level} <${node.tagname}> ${name} attribute value: ${value}`, opts);
            this.remainingAttNames.delete(name);
        }
        return this;
    }

    checkRemainingAttributes(): ElementValidation {
        const { remainingAttNames, callbacks, node, opts, level } = this;
        if (node) {
            if (remainingAttNames.size > 0) {
                callbacks.onWarning(node, `Bad ${level} <${node.tagname}> attribute name${remainingAttNames.size > 1 ? 's' : ''}: ${[...remainingAttNames].join(', ')}`, opts);
            }
        }
        return this;
    }

}
