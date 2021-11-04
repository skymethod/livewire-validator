import { html, css, unsafeCSS } from '../deps_app.ts';
import { Theme } from '../theme.ts';
import { computeAttributeMap, XmlNode } from '../validator.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';

export const XML_HTML = html`
<output id="xml"></output>
`;

export const XML_CSS = css`
#xml {
    font-family: ${unsafeCSS(Theme.monospaceFontFamily)};
    font-size: 0.75rem;
    line-height: 1rem;
    color: ${unsafeCSS(Theme.textColorHex)};
    overflow-wrap: break-word;
}

#xml .indent {
    margin-left: 1rem;
}

#xml .indent2 {
    margin-left: 2rem;
}

summary.empty { list-style: none; cursor: text; }
summary.empty::-webkit-details-marker { display: none; }

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
    if (xml) renderNode(xml, xmlOutput, 0, new Set(), undefined);
}

function renderNode(node: XmlNode, containerElement: HTMLElement, level: number, context: Set<string>, itemNumber: number | undefined) {
    const details = document.createElement('details');
    const text = node.val || '';
    details.open = !context.has('found-item') || text.length > 0;
    if (level > 0) details.classList.add('indent');
    const summary = document.createElement('summary');
    const atts = computeAttributeMap(node.attrsMap);
    if (level === 0) {
        renderTextPieces(summary, 'Xml');
    } else {
        renderTextPieces(summary, '<', node.tagname, ...[...atts.entries()].flatMap(v => [` ${v[0]}="`, v[1], '"']), '>', itemNumber ? ` #${itemNumber}` : '');
    }
    details.appendChild(summary);
    let childCount = 0;
    if (text.length > 0) {
        const div = document.createElement('div');
        renderTextPieces(div, text)
        div.classList.add('indent2');
        details.appendChild(div);
        childCount++;
    }
    for (const [_, value] of Object.entries(node.child)) {
        let itemNumber = 1;
        for (const child of value) {
            renderNode(child, details, level + 1, context, value.length > 1 ? itemNumber : undefined);
            childCount++;
            itemNumber++;
        }
    }
    if (childCount === 0) summary.classList.add('empty', 'indent');
    containerElement.appendChild(details);
    if (node.tagname === 'item') context.add('found-item');
}

function renderTextPieces(element: HTMLElement, ...pieces: string[]) {
    for (const piece of pieces) {
        if (/^https?:\/\/[^\s)]+$/.test(piece)) {
            const a = document.createElement('a');
            a.href = piece;
            a.target = '_blank';
            a.rel = 'noreferrer noopener nofollow';
            a.appendChild(document.createTextNode(piece));
            element.appendChild(a);
        } else {
            element.appendChild(document.createTextNode(piece));
        }
    }
}
