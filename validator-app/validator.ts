import { getTraversalObj } from './deps_app.ts';
import { checkEqual } from './check.ts';
import { Qnames, Qname } from './qnames.ts';

export function parseFeedXml(xml: string): ExtendedXmlNode {
    const rt = getTraversalObj(xml, { ignoreAttributes: false, parseAttributeValue: false, parseNodeValue: false }) as XmlNode;
    const namespaces = new XmlNamespaces();
    applyQnames(rt, namespaces);
    checkEqual('namespaces.stackSize', namespaces.stackSize, 0);
    return rt as ExtendedXmlNode;
}

export function validateFeedXml(xml: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    if (xml.tagname !== '!xml') return callbacks.onError(xml, `Bad xml.tagname: ${xml.tagname}`);
    if (Object.keys(xml.attrsMap).length > 0) return callbacks.onError(xml, `Bad xml.attrsMap: ${xml.attrsMap}`);

    const docElement = Object.values(xml.child).flatMap(v => v)[0];
    if (!docElement) return callbacks.onError(xml, `No xml root element`); 
    validateRss(docElement as ExtendedXmlNode, callbacks);
}

export function computeAttributeMap(attrsMap: Record<string, string> | undefined): ReadonlyMap<string, string> {
    let map: Map<string, string> | undefined;
    if (attrsMap) {
        for (const [ name, value ] of Object.entries(attrsMap)) {
            if (!name.startsWith('@_')) throw new Error(`Bad attrsMap name: ${name}, ${attrsMap}`);
            map = map || new Map<string, string>();
            map.set(name.substring(2), value);
        }
    }
    return map || EMPTY_MAP;
}

export interface XmlNode {
    readonly tagname: string; // !xml for top-level
    readonly attrsMap: Record<string, string>; // e.g. @_version: "2.0", @_xmlns:itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd"
    readonly child: Record<string, XmlNode[]>;
    readonly parent?: XmlNode;
    readonly val?: string;
}

export interface MessageOptions {
    readonly tag?: string;
    readonly reference?: RuleReference
}

export interface ValidationCallbacks {
    onGood(node: ExtendedXmlNode, message: string, opts?: MessageOptions): void;
    onInfo(node: ExtendedXmlNode, message: string, opts?: MessageOptions): void;
    onError(node: ExtendedXmlNode, message: string, opts?: MessageOptions): void;
    onWarning(node: ExtendedXmlNode, message: string, opts?: MessageOptions): void;
}

export type ExtendedXmlNode = XmlNode & {
    readonly atts: Map<string, string>;
    readonly qname: Qname;
};

export interface RuleReference {
    readonly ruleset: string;
    readonly href: string;
}

//

const EMPTY_MAP: ReadonlyMap<string, string> = new Map<string, string>();
const EMPTY_XML_NODE_ARRAY: readonly ExtendedXmlNode[] = [];

function getSingleChild(node: ExtendedXmlNode, name: string, callbacks: ValidationCallbacks, opts: MessageOptions = {}): ExtendedXmlNode | undefined {
    const children = findChildElements(node, { name });
    if (children.length !== 1) {
        callbacks.onError(node, `Expected single <${name}> child element under <${node.tagname}>, found ${children.length === 0 ? 'none' : children.length}`, opts);
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
    checkAttributeEqual(rss, 'xmlns:itunes', 'http://www.itunes.com/dtds/podcast-1.0.dtd', callbacks, itunesOpts);
    checkAttributeEqual(rss, 'xmlns:content', 'http://purl.org/rss/1.0/modules/content/', callbacks, itunesOpts);

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
    const guidReference: RuleReference = { ruleset: 'podcastindex', href: 'https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#guid' };
    const guids = findChildElements(channel, ...Qnames.PodcastIndex.guid);
    if (guids.length > 0) {
        if (guids.length > 1) callbacks.onWarning(guids[1], 'Multiple <podcast:guid> elements are not allowed', { reference: guidReference });
        const guid = guids[0];
        const guidText = checkText(guid, isUuid, callbacks, { reference: guidReference });
        if (guidText) {
            const version = guidText.charAt(14);
            if (version !== '5') {
                callbacks.onWarning(guid, `Bad <${guid.tagname}> value: ${guidText}, expected a UUIDv5, found a UUIDv${version}`, { reference: guidReference });
            }
        }
        const attNames = [...guid.atts.keys()];
        if (attNames.length > 0) {
            callbacks.onWarning(guid, `Bad <${guid.tagname}> attribute names: ${attNames.join(', ')}`, { reference: guidReference });
        }
    }

    // continue to items
    for (const item of channel.child.item || []) {
        validateItem(item as ExtendedXmlNode, callbacks);
        break;
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

function isNotEmpty(trimmedText: string): boolean {
    return trimmedText.length > 0;
}

function isUrl(trimmedText: string): boolean {
    return /^https?:\/\/.+?$/.test(trimmedText);
}

function isMimeType(trimmedText: string): boolean {
    return /^\w+\/[-+.\w]+$/.test(trimmedText);
}

function isUuid(trimmedText: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(trimmedText);
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
        if (length && !/^\d+$/.test(length)) callbacks.onWarning(enclosure, `Bad item <enclosure> length attribute value: ${length}, expected non-negative integer`, rssEnclosureOpts);

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

    // podcast index
    const socialInteracts = findChildElements(item, ...Qnames.PodcastIndex.socialInteract);
    for (const socialInteract of socialInteracts) {
        callbacks.onGood(socialInteract, 'Found <podcast:socialInteract>!', { tag: 'social-interact', reference: { ruleset: 'podcastindex', href: 'https://github.com/benjaminbellamy/podcast-namespace/blob/patch-9/proposal-docs/social/social.md#socialinteract-element' } });
    }
}

function findChildElements(node: ExtendedXmlNode, ...qnames: readonly Qname[]): readonly ExtendedXmlNode[] {
    let rt: ExtendedXmlNode[] | undefined;
    for (const value of Object.values(node.child)) {
        for (const qname of qnames) {
            for (const child of value) {
                const extChild = child as ExtendedXmlNode;
                if (Qnames.eq(qname, extChild.qname)) {
                    rt = rt || [];
                    rt.push(extChild);
                }
            }
        }
    }
    return rt || EMPTY_XML_NODE_ARRAY;
}

function applyQnames(node: XmlNode, namespaces: XmlNamespaces) {
    try {
        const atts = namespaces.push(node.attrsMap);
        // deno-lint-ignore no-explicit-any
        const nodeAsAny = node as any;
        nodeAsAny.atts = atts;
        nodeAsAny.qname = computeQname(node.tagname, namespaces);
        for (const value of Object.values(node.child)) {
            for (const childNode of value) {
                applyQnames(childNode, namespaces);
            }
        }
    } finally {
        namespaces.pop();
    }
}

function computeQname(nameWithOptionalPrefix: string, namespaces: XmlNamespaces): Qname {
    const i = nameWithOptionalPrefix.indexOf(':');
    if (i < 0) return { name: nameWithOptionalPrefix, namespaceUri: namespaces.findNamespaceUri('') };
    return { name: nameWithOptionalPrefix.substring(i + 1), namespaceUri: namespaces.getNamespaceUri(nameWithOptionalPrefix.substring(0, i)) };
}

//

class XmlNamespaces {

    private stack: ReadonlyMap<string, string>[] = [];

    get stackSize(): number { return this.stack.length; }

    push(attrsMap: Record<string, string>): ReadonlyMap<string, string> {
        const attrs = computeAttributeMap(attrsMap);
        let map: Map<string, string> | undefined;
        for (const [ name, value ] of attrs.entries()) {
            if (name === 'xmlns') {
                map = map || new Map<string, string>();
                map.set('', value);
            } else if (name.startsWith('xmlns:')) {
                map = map || new Map<string, string>();
                const prefix = name.substring(6);
                map.set(prefix, value);
            }
        }
        this.stack.push(map || EMPTY_MAP);
        return attrs;
    }

    pop() {
        this.stack.pop();
    }

    findNamespaceUri(prefix: string): string | undefined {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const rt = this.stack[i].get(prefix);
            if (rt) return rt;
        }
        return undefined;
    }

    getNamespaceUri(prefix: string): string {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const rt = this.stack[i].get(prefix);
            if (rt) return rt;
        }
        throw new Error(`getNamespaceUri: prefix not found: ${prefix}`);
    }

}
