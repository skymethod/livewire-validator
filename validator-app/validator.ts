import { getTraversalObj } from './deps_app.ts';
import { checkEqual } from './check.ts';
import { Qnames, Qname } from './qnames.ts';

export function parseFeedXml(xml: string): XmlNode {
    return getTraversalObj(xml, { ignoreAttributes: false, parseAttributeValue: false, parseNodeValue: false }) as XmlNode;
}

export function validateFeedXml(xml: XmlNode, callbacks: ValidationCallbacks) {
    if (xml.tagname !== '!xml') return callbacks.onError(xml, `Bad xml.tagname: ${xml.tagname}`);
    if (Object.keys(xml.attrsMap).length > 0) return callbacks.onError(xml, `Bad xml.attrsMap: ${xml.attrsMap}`);

    const namespaces = new XmlNamespaces();
    applyQnames(xml, namespaces);
    checkEqual('namespaces.stackSize', namespaces.stackSize, 0);

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

export interface ValidationCallbacks {
    onInfo(node: XmlNode, message: string, opts?: { tag?: string, reference?: RuleReference }): void;
    onError(node: XmlNode, message: string, opts?: { tag?: string, reference?: RuleReference }): void;
    onWarning(node: XmlNode, message: string, opts?: { tag?: string, reference?: RuleReference }): void;
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

function getSingleChild(node: XmlNode, tagName: string, callbacks: ValidationCallbacks, opts: Options = {}): ExtendedXmlNode | undefined {
    const children = node.child[tagName] || [];
    if (children.length !== 1) {
        callbacks.onError(node, `Expected single ${tagName} child element under ${node.tagname}, found ${children.length === 0 ? 'none' : children.length}`, opts);
        return undefined;
    }
    return children[0] as ExtendedXmlNode;
}

function validateRss(rss: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    // rss required
    const opts: Options = { reference: { ruleset: 'rss', href: 'https://cyber.harvard.edu/rss/rss.html#whatIsRss' } };
    if (rss.tagname !== 'rss') return callbacks.onError(rss, `Bad xml root tag: ${rss.tagname}, expected rss`, opts);
    const version = rss.atts.get('version');
    if (version !== '2.0') callbacks.onWarning(rss, `Bad rss.version: ${version}, expected 2.0`, opts);

    // itunes required
    const itunesOpts: Options = { reference: { ruleset: 'itunes', href: 'https://podcasters.apple.com/support/823-podcast-requirements#:~:text=Podcast%20RSS%20feed%20technical%20requirements' } };
    checkAttributeEqual(rss, 'xmlns:itunes', 'http://www.itunes.com/dtds/podcast-1.0.dtd', callbacks, itunesOpts);
    checkAttributeEqual(rss, 'xmlns:content', 'http://purl.org/rss/1.0/modules/content/', callbacks, itunesOpts);

    // continue to channel
    const channel = getSingleChild(rss, 'channel', callbacks, opts); if (!channel) return;
    validateChannel(channel as ExtendedXmlNode, callbacks);
}

function validateChannel(channel: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    // rss required
    const opts: Options = { reference: { ruleset: 'rss', href: 'https://cyber.harvard.edu/rss/rss.html#requiredChannelElements' } };
    const title = getSingleChild(channel, 'title', callbacks, opts);
    checkText(title, isNotEmpty, callbacks, opts);
    const link = getSingleChild(channel, 'link', callbacks, opts);
    checkText(link, isUrl, callbacks, opts);
    const description = getSingleChild(channel, 'description', callbacks, opts);
    checkText(description, isNotEmpty, callbacks, opts);

    // continue to items
    for (const item of channel.child.item || []) {
        validateItem(item as ExtendedXmlNode, callbacks);
        break;
    }
}

function checkAttributeEqual(node: ExtendedXmlNode, attName: string, attExpectedValue: string, callbacks: ValidationCallbacks, opts: Options = {}) {
    const attValue = node.atts.get(attName);
    if (!attValue) {
        callbacks.onWarning(node, `Missing <${node.tagname}> ${attName} attribute, expected ${attExpectedValue}`, opts);
    } else if (attValue !== attExpectedValue) {
        callbacks.onWarning(node, `Bad <${node.tagname}> ${attName} attribute value: ${attValue}, expected ${attExpectedValue}`, opts);
    }
}

function checkText(node: ExtendedXmlNode | undefined, test: (trimmedText: string) => boolean, callbacks: ValidationCallbacks, opts: Options = {}) {
    if (node) {
        const trimmedText = (node.val || '').trim();
        if (!test(trimmedText)) {
            callbacks.onWarning(node, `Bad <${node.tagname}> text content: ${trimmedText === '' ? '<empty>' : trimmedText}`, opts);
        }
    }
}

function isNotEmpty(trimmedText: string): boolean {
    return trimmedText.length > 0;
}

function isUrl(trimmedText: string): boolean {
    return /^https?:\/\/.+?$/.test(trimmedText);
}

function validateItem(item: ExtendedXmlNode, callbacks: ValidationCallbacks) {
    const socialInteracts = findChildElements(item, ...Qnames.PodcastIndex.socialInteract);
    for (const socialInteract of socialInteracts) {
        callbacks.onInfo(socialInteract, 'Found <podcast:socialInteract>!', { tag: 'social-interact' });
    }
}

function findChildElements(node: ExtendedXmlNode, ...qnames: readonly Qname[]): readonly ExtendedXmlNode[] {
    let rt: ExtendedXmlNode[] | undefined;
    for (const value of Object.values(node.child)) {
        const childQname = value.length > 0 ? (value[0] as ExtendedXmlNode).qname : undefined;
        if (!childQname) continue;
        for (const qname of qnames) {
            if (Qnames.eq(childQname, qname)) {
                rt = rt || [];
                rt.push(...value as ExtendedXmlNode[]);
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

interface Options {
    reference?: RuleReference;
}

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
