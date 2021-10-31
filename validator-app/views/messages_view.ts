import { html, LitElement, css } from '../deps_app.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';

export const MESSAGES_HTML = html`
<output id="messages"></output>
`;

export const MESSAGES_CSS = css`

`;

export function initMessages(document: Document, vm: ValidatorAppVM): () => void {
    const messagesOutput = document.getElementById('messages') as HTMLOutputElement;
    return () => {
        LitElement.render(MESSAGE_HTML(vm), messagesOutput);
    };
}

//

const MESSAGE_HTML = (vm: ValidatorAppVM) => html`
    ${vm.messages.map(message => html`<div>${message.text}</div>`)}`;
