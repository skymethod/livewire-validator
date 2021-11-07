import { html, css, unsafeCSS } from '../deps_app.ts';
import { Qnames } from '../qnames.ts';
import { Theme } from '../theme.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';
import { qnameEq, ExtendedXmlNode, qnamesInclude } from '../xml_parser.ts';
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
    line-height: 1.4;
}

#xml .root {
    font-family: ${unsafeCSS(Theme.sansSerifFontFamily)};
    color: ${unsafeCSS(Theme.textColorHex)};
    line-height: 2;
}

#xml .content {
    color: ${unsafeCSS(Theme.textColorHex)};
}

#xml .podcast {
    color: #ab47bc;
}

#xml .indent {
    margin-left: 0.75rem;
}

#xml .indent2 {
    margin-left: 1.5rem;
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
            renderXml(xml, xmlOutput, vm.xmlSummaryText);
            _renderedXml = xml;
        }
    };
}

//

const MAX_ITEMS_TO_DISPLAY = 20;

let _renderedXml: ExtendedXmlNode | undefined;

function renderXml(xml: ExtendedXmlNode | undefined, xmlOutput: HTMLOutputElement, xmlSummaryText?: string) {
    while (xmlOutput.firstChild) xmlOutput.removeChild(xmlOutput.firstChild);
    if (xml) renderNode(xml, xmlOutput, 0, new Set(), undefined, xmlSummaryText);
}

function renderNode(node: ExtendedXmlNode, containerElement: HTMLElement, level: number, context: Set<string>, itemNumber: number | undefined, xmlSummaryText?: string) {
    const { atts } = node;
    const details = document.createElement('details');
    const text = node.val || '';
    details.open = !context.has('found-item') || text.length > 0;
    if (level > 0) details.classList.add('indent');
    const summary = document.createElement('summary');
    if (level === 0) {
        renderTextPieces(summary, xmlSummaryText || 'Xml');
        summary.classList.add('root');
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
    for (const [name, value] of Object.entries(node.child)) {
        let itemNumber = 1;
        let itemsNotShown = 0;
        for (const child of value) {
            if (name === 'item' && itemNumber > MAX_ITEMS_TO_DISPLAY) {
                itemsNotShown++;
                continue;
            }
            renderNode(child as ExtendedXmlNode, details, level + 1, context, value.length > 1 ? itemNumber : undefined);
            childCount++;
            itemNumber++;
        }
        if (itemsNotShown > 0) {
            const fakeNode: ExtendedXmlNode = {
                tagname: `...and ${new Intl.NumberFormat().format(itemsNotShown)} more items`, 
                atts: new Map<string, string>(),
                qname: { name: '' },
                attrsMap: {},
                child: {},
             };
            renderNode(fakeNode, details, level - 1, context, undefined);
        }
    }
    const audioUrl = node.tagname === 'enclosure' && atts.get('url') 
        || node.qname.namespaceUri && qnamesInclude(Qnames.PodcastIndex.source, node.qname) && atts.get('uri') 
        || qnameEq(node.qname, Qnames.MediaRss.content) && (atts.get('type') || '').startsWith('audio') && atts.get('url')
        ;
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
