import { getTraversalObj } from './deps_app.ts';
import { checkEqual } from './check.ts';

export function parseFeedXml(xml: string): XmlNode {
    return getTraversalObj(xml, { ignoreAttributes: false }) as XmlNode;
}

export function validateFeedXml(xml: XmlNode, callbacks: ValidationCallbacks) {
    if (xml.tagname !== '!xml') return callbacks.onError(xml, `Bad xml.tagname: ${xml.tagname}`);
    if (Object.keys(xml.attrsMap).length > 0) return callbacks.onError(xml, `Bad xml.attrsMap: ${xml.attrsMap}`);

    const namespaces = new XmlNamespaces();

    const rss = getSingleChild(xml, 'rss', callbacks); if (!rss) return;
    validateRss(rss, callbacks, namespaces);
    checkEqual('namespaces.stackSize', namespaces.stackSize, 0);
}

export function computeAttributeMap(attrsMap: Record<string, string>): ReadonlyMap<string, string> {
    let map: Map<string, string> | undefined;
    for (const [ name, value ] of Object.entries(attrsMap)) {
        if (!name.startsWith('@_')) throw new Error(`Bad attrsMap name: ${name}, ${attrsMap}`);
        map = map || new Map<string, string>();
        map.set(name.substring(2), value);
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
    onError(node: XmlNode, message: string): void;
    onWarning(node: XmlNode, message: string): void;
}


//

function getSingleChild(node: XmlNode, tagName: string, callbacks: ValidationCallbacks): XmlNode | undefined {
    const children = node.child[tagName] || [];
    if (children.length !== 1) {
        callbacks.onError(node, `Expected single ${tagName} child element under ${node.tagname}, found ${children.length}`);
        return undefined;
    }
    return children[0];
}

function validateRss(rss: XmlNode, callbacks: ValidationCallbacks, namespaces: XmlNamespaces) {
    const attrs = namespaces.push(rss.attrsMap);
    console.log(attrs);
    try {
        if (rss.tagname !== 'rss') return callbacks.onError(rss, `Bad rss.tagname: ${rss.tagname}`);
        const version = attrs.get('version');
        if (version !== '2.0') callbacks.onWarning(rss, `Bad rss.version: ${version}, expected 2.0`);
        const channel = getSingleChild(rss, 'channel', callbacks); if (!channel) return;
        validateChannel(channel, callbacks, namespaces);
    } finally {
        namespaces.pop();
    }
}

function validateChannel(channel: XmlNode, callbacks: ValidationCallbacks, namespaces: XmlNamespaces) {
    const _ = namespaces.push(channel.attrsMap);
    try {
        if (channel.tagname !== 'channel') return callbacks.onError(channel, `Bad channel.tagname: ${channel.tagname}`);
        // TODO
    } finally {
        namespaces.pop();
    }
}

//

const EMPTY_MAP: ReadonlyMap<string, string> = new Map<string, string>();

class XmlNamespaces {
    private stack: ReadonlyMap<string, string>[] = [];

    get stackSize(): number { return this.stack.length; }

    push(attrsMap: Record<string, string>): ReadonlyMap<string, string> {
        const rt = computeAttributeMap(attrsMap);
        let map: Map<string, string> | undefined;
        for (const [ name, value ] of Object.entries(attrsMap)) {
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
        return rt;
    }

    pop() {
        this.stack.pop();
    }

}
