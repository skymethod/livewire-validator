import { html, css, unsafeCSS } from '../deps_app.ts';
import { Qnames } from '../qnames.ts';
import { Theme } from '../theme.ts';
import { computeAttributeMap, ExtendedXmlNode, XmlNode } from '../validator.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';
import { externalizeAnchor } from './util.ts';

export const XML_HTML = html`
<output id="xml"></output>
`;

export const XML_CSS = css`
#xml {
    font-family: ${unsafeCSS(Theme.monospaceFontFamily)};
    font-size: 0.75rem;
    line-height: 1rem;
    color: ${unsafeCSS(Theme.textColorSecondaryHex)};
    overflow-wrap: break-word;
}

#xml .content {
    color: ${unsafeCSS(Theme.textColorHex)};
}

#xml .podcast {
    color: #ab47bc;
}

#xml .indent {
    margin-left: 1rem;
}

#xml .indent2 {
    margin-left: 2rem;
}

summary.empty { list-style: none; cursor: text; }
summary.empty::-webkit-details-marker { display: none; }

#xml audio {
    margin: 0.5rem 1rem;
}
`;

export function initXml(document: Document, vm: ValidatorAppVM): () => void {
    const xmlOutput = document.getElementById('xml') as HTMLOutputElement;
    return () => {
        const xml = vm.xml;
        if (xml !== _renderedXml) {
            renderXml(xml, xmlOutput);
            _renderedXml = xml;
        }
    };
}

//

let _renderedXml: XmlNode | undefined;

function renderXml(xml: XmlNode | undefined, xmlOutput: HTMLOutputElement) {
    while (xmlOutput.firstChild) xmlOutput.removeChild(xmlOutput.firstChild);
    if (xml) renderNode(xml as ExtendedXmlNode, xmlOutput, 0, new Set(), undefined);
}

function renderNode(node: ExtendedXmlNode, containerElement: HTMLElement, level: number, context: Set<string>, itemNumber: number | undefined) {
    const details = document.createElement('details');
    const text = node.val || '';
    details.open = !context.has('found-item') || text.length > 0;
    if (level > 0) details.classList.add('indent');
    const summary = document.createElement('summary');
    const atts = computeAttributeMap(node.attrsMap);
    if (level === 0) {
        renderTextPieces(summary, 'Xml');
    } else {
        const spanClass = Qnames.PodcastIndex.NAMESPACES.includes(node.qname.namespaceUri || '') ? 'podcast' : undefined;
        renderTextPieces(summary, '<', { text: node.tagname, spanClass }, ...[...atts.entries()].flatMap(v => [` ${v[0]}="`, { text: v[1], spanClass: 'content' }, '"']), '>', itemNumber ? ` #${itemNumber}` : '');
    }
    details.appendChild(summary);
    let childCount = 0;
    if (text.length > 0) {
        const div = document.createElement('div');
        div.classList.add('content');
        renderTextPieces(div, text)
        div.classList.add('indent2');
        details.appendChild(div);
        childCount++;
    }
    for (const [_, value] of Object.entries(node.child)) {
        let itemNumber = 1;
        for (const child of value) {
            renderNode(child as ExtendedXmlNode, details, level + 1, context, value.length > 1 ? itemNumber : undefined);
            childCount++;
            itemNumber++;
        }
    }
    const audioUrl = node.tagname === 'enclosure' && atts.get('url') 
        || node.qname.namespaceUri && Qnames.includes(Qnames.PodcastIndex.source, node.qname) && atts.get('uri') 
        || Qnames.eq(node.qname, Qnames.MediaRss.content) && atts.get('url');
    if (audioUrl) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'none';
        audio.src = audioUrl;
        details.appendChild(audio);
        childCount++;
    }
    if (childCount === 0) summary.classList.add('empty', 'indent');
    containerElement.appendChild(details);
    if (node.tagname === 'item') context.add('found-item');
}

function renderTextPieces(element: HTMLElement, ...pieces: (string | { text: string, spanClass?: string })[]) {
    for (const piece of pieces) {
        const text = typeof piece === 'string' ? piece : piece.text;
        const spanClass = typeof piece === 'object' ? piece.spanClass : undefined;
        if (/^https?:\/\/[^\s)]+$/.test(text)) {
            const a = document.createElement('a');
            a.href = text;
            externalizeAnchor(a);
            a.appendChild(document.createTextNode(text));
            element.appendChild(a);
        } else {
            const textNode = document.createTextNode(text);
            if (spanClass) {
                const span = document.createElement('span');
                span.classList.add(spanClass);
                span.appendChild(textNode);
                element.appendChild(span);
            } else {
                element.appendChild(textNode);
            }
        }
    }
}
