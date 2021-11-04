import { html, LitElement, css, unsafeCSS } from '../deps_app.ts';
import { Theme } from '../theme.ts';
import { Message, MessageType, ValidatorAppVM } from '../validator_app_vm.ts';
import { CHECK_ICON, ERROR_ICON, INFO_ICON, WARNING_ICON } from './icons.ts';

export const MESSAGES_HTML = html`
<output id="messages"></output>
`;

export const MESSAGES_CSS = css`

#messages {
    margin-bottom: 1rem;
}

#messages > div {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.75rem;
    animation: fadeInAnimation 0.5s;
}

#messages > div.loaded {
    opacity: 1;
}

#messages svg {
    transform: scale(0.75);
    fill: currentColor;
}

#messages > div.info {
    color: ${unsafeCSS(Theme.textColorSecondaryHex)};
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

#messages .progress-icon {
    width: 24px;
    height: 24px;
    display: flex;
    justify-content: center;
}

#messages progress {
    font-size: 0.35rem;
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
    ${vm.messages.filter(filterDuplicates()).map(message => html`<div class=${message.type}>${icon(message.type)}${message.text}${message.url ? ANCHOR_HTML(message.url) : undefined}</div>`)}`;

const ANCHOR_HTML = (url: string) => html`<a href=${url} target="_blank" rel="noreferrer noopener nofollow">${url}</a>`;

function icon(type: MessageType) {
    return type === 'running' ? html`<div class="progress-icon"><progress class="pure-material-progress-circular"></progress></div>`
        : type === 'done' ? CHECK_ICON
        : type === 'error' ? ERROR_ICON
        : type === 'warning' ? WARNING_ICON
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
