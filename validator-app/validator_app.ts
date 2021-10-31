/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { css, html, LitElement } from './deps_app.ts';
import { StaticData } from './static_data.ts';
import { ValidatorAppVM } from './validator_app_vm.ts';
import { FORM_CSS, FORM_HTML, initForm } from './views/form_view.ts';
import { initMessages, MESSAGES_HTML, MESSAGES_CSS } from './views/messages_view.ts';

const appModuleScript = document.getElementById('app-module-script') as HTMLScriptElement;

function setAppState(appState: string) {
    appModuleScript.dataset.state = appState;
}
setAppState('starting');

const appCss = css`
main {
    margin: 2rem;
    display: flex;
    flex-direction: column;
}
`;

const appHtml = html`
<main>
${FORM_HTML}
${MESSAGES_HTML}
</main>
`;

function appendStylesheets(cssTexts: string[]) {
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.textContent = cssTexts.join('\n\n');
    document.head.appendChild(styleSheet);
}

appendStylesheets([
    appCss.cssText, 
    FORM_CSS.cssText,
    MESSAGES_CSS.cssText,
]);

LitElement.render(appHtml, document.body);

function parseStaticData(): StaticData {
    const script = document.getElementById('static-data-script') as HTMLScriptElement;
    const data = JSON.parse(script.text);
    const version = typeof data.version === 'string' ? data.version : undefined;
    const flags = typeof data.flags === 'string' ? data.flags : undefined;
    const debug = typeof data.debug === 'object' ? data.debug : undefined;
    return { version, flags, debug };
}

const _data = parseStaticData();

const vm = new ValidatorAppVM();
const updateForm = initForm(document, vm);
const updateMessages = initMessages(document, vm);

vm.onChange = () => {
    updateForm();
    updateMessages();
};

vm.start();
setAppState('started');
