import { css, html, LitElement, unsafeCSS, Theme, Fetcher, PISearchFetcher } from './deps_app.ts';
import { StaticData } from './static_data.ts';
import { ValidatorAppVM } from './validator_app_vm.ts';
import { CIRCULAR_PROGRESS_CSS } from './views/circular_progress_view.ts';
import { COMMENTS_CSS, COMMENTS_HTML, initComments } from './views/comments_view.ts';
import { FORM_CSS, FORM_HTML, initForm } from './views/form_view.ts';
import { initMessages, MESSAGES_HTML, MESSAGES_CSS } from './views/messages_view.ts';
import { initSearchResults, SEARCH_RESULTS_HTML, SEARCH_RESULTS_CSS } from './views/search_results_view.ts';
import { initXml, XML_CSS, XML_HTML } from './views/xml_view.ts';

const appModuleScript = document.getElementById('app-module-script') as HTMLScriptElement;

function setAppState(appState: string) {
    appModuleScript.dataset.state = appState;
}
setAppState('starting');

const appCss = css`

a {
    color: ${unsafeCSS(Theme.primaryColor300Hex)};
    text-underline-offset: 0.2rem;
    text-decoration: none;
}

@media (hover: hover) {
    a:hover {
        text-decoration: underline;
    }
}

main {
    margin: 2rem;
    display: flex;
    flex-direction: column;
}

@keyframes fadeInAnimation {
    0% {
        opacity: 0;
    }
    100% {
        opacity: 1;
    }
}

summary {
    cursor: pointer;
}

`;

const appHtml = html`
<main>
${FORM_HTML}
${MESSAGES_HTML}
${SEARCH_RESULTS_HTML}
${COMMENTS_HTML}
${XML_HTML}
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
    SEARCH_RESULTS_CSS.cssText,
    COMMENTS_CSS.cssText,
    XML_CSS.cssText,
    CIRCULAR_PROGRESS_CSS.cssText,
]);

LitElement.render(appHtml, document.body);

function parseStaticData(): StaticData {
    const script = document.getElementById('static-data-script') as HTMLScriptElement;
    const data = JSON.parse(script.text);
    const version = typeof data.version === 'string' ? data.version : undefined;
    const flags = typeof data.flags === 'string' ? data.flags : undefined;
    const debug = typeof data.debug === 'object' ? data.debug : undefined;
    const pushId = typeof data.pushId === 'string' ? data.pushId : undefined;
    return { version, flags, debug, pushId };
}

const staticData = parseStaticData();

const droppedFiles = new Map<string, string>(); // file: url -> text contents
const localFetcher: Fetcher = (url, headers) => {
    const droppedFileText = droppedFiles.get(url);
    if (droppedFileText) return Promise.resolve(new Response(droppedFileText));
    if (new URL(url).protocol === 'file:') throw new Error('Unknown dropped file, try dropping it again');
    return fetch(url, { headers });
};
const remoteFetcher: Fetcher = (url, headers) => fetch(`/f/${url.replaceAll(/[^a-zA-Z0-9.]+/g, '_')}`, { method: 'POST', body: JSON.stringify({ url, headers }) });
const piSearchFetcher: PISearchFetcher = (input, headers) => fetch(`/s`, { method: 'POST', body: JSON.stringify({ input, headers }) });
const threadcapUserAgent = navigator.userAgent;

const vm = new ValidatorAppVM({ threadcapUserAgent, localFetcher, remoteFetcher, piSearchFetcher });
const updateForm = initForm(document, vm, staticData, droppedFiles);
const updateMessages = initMessages(document, vm);
const updateSearchResults = initSearchResults(document, vm);
const updateComments = initComments(document, vm);
const updateXml = initXml(document, vm);

vm.onChange = () => {
    updateForm();
    updateMessages();
    updateSearchResults();
    updateComments();
    updateXml();
};

vm.start();
setAppState('started');
