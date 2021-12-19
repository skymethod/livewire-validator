import { html, LitElement, css, unsafeCSS, Theme, RuleReference } from '../deps_app.ts';
import { Message, MessageType, ValidatorAppVM } from '../validator_app_vm.ts';
import { CHECK_ICON, ERROR_ICON, INFO_ICON, WARNING_ICON } from './icons.ts';

export const MESSAGES_HTML = html`
<output id="messages"></output>
`;

export const MESSAGES_CSS = css`

#messages {
    margin-bottom: 1rem;
    display: grid;
    grid-template-columns: 2rem auto;
    align-items: center;
    font-size: 0.75rem;
}

#messages > div, #messages > a {
    animation: fadeInAnimation 0.4s;
}

#messages svg {
    transform: scale(0.75);
    fill: currentColor;
}

#messages > div.info {
    color: ${unsafeCSS(Theme.textColorSecondaryHex)};
}

#messages > div.good {
    color: #43a047;
}
#messages > div.warning {
    color: #e65100;
}

#messages > div.error {
    color: #b71c1c;
}

#messages > div.running, #messages > div.done {
    color: ${unsafeCSS(Theme.textColorHex)};
}

#messages .icon {
    grid-column: 1;
    width: 24px;
    height: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
}

#messages .message {
    grid-column: 2;
}

#messages .url {
    grid-column: 2;
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
}

#messages progress {
    font-size: 0.35rem;
}

#messages .reference {
    display: inline-block;
    margin-left: 0.25rem;
}

`;

export function initMessages(document: Document, vm: ValidatorAppVM): () => void {
    const messagesOutput = document.getElementById('messages') as HTMLOutputElement;
    return () => {
        LitElement.render(MESSAGE_HTML(vm), messagesOutput);
    };
}

//

const MESSAGE_HTML = (vm: ValidatorAppVM) => html`
    ${vm.messages.filter(filterDuplicates()).map(message => html`
        <div class="${message.type} icon">${icon(message.type)}</div>
        <div class="${message.type} message">${message.text}${REFERENCE_HTML(message.reference)}</div>
        ${ANCHOR_HTML(message.url)}`)}`;

const REFERENCE_HTML = (reference: RuleReference | undefined) => reference ? html`<a class="reference" href=${reference.href} target="_blank" rel="noreferrer noopener nofollow">[${reference.ruleset}]</a>` : undefined;
const ANCHOR_HTML = (url: string | undefined) => url ? html`<a href=${url} target="_blank" rel="noreferrer noopener nofollow" class="url">${url}</a>` : undefined;

function icon(type: MessageType) {
    return type === 'running' ? html`<progress class="pure-material-progress-circular"></progress>`
        : type === 'done' ? CHECK_ICON
        : type === 'error' ? ERROR_ICON
        : type === 'warning' ? WARNING_ICON
        : type === 'good' ? CHECK_ICON
        : INFO_ICON;
}

function filterDuplicates(): (message: Message) => boolean {
    const tagUrls = new Set<string>();
    return message => {
        const { tag, url } = message;
        if (tag && url) {
            const tagUrl = `${tag}|${url}`;
            if (tagUrls.has(tagUrl)) return false;
            tagUrls.add(tagUrl);
            return true;
        }
        return true;
    };
}
