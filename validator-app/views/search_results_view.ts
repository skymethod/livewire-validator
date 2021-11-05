import { html, LitElement, css, unsafeCSS } from '../deps_app.ts';
import { Theme } from '../theme.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';
import { SQUARE_ICON } from './icons.ts';

export const SEARCH_RESULTS_HTML = html`
<output id="search-results"></output>
`;

export const SEARCH_RESULTS_CSS = css`

#search-results {
    margin-bottom: 1rem;
    display: none;
}

#search-results > div {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.75rem;
    animation: fadeInAnimation 0.5s;
    margin-bottom: 0.75rem;
    cursor: pointer;
}

#search-results .icon, #search-results img {
    width: 1.5rem;
    height: 1.5rem;
}

#search-results .title {
    color: ${unsafeCSS(Theme.textColorHex)};
}

#search-results .author {
    color: ${unsafeCSS(Theme.textColorSecondaryHex)};
}

`;

export function initSearchResults(document: Document, vm: ValidatorAppVM): () => void {
    const searchResultsOutput = document.getElementById('search-results') as HTMLOutputElement;
    return () => {
        LitElement.render(RESULTS_HTML(vm), searchResultsOutput);
        searchResultsOutput.style.display = vm.isSearch ? 'block' : 'none';
    };
}

//

const RESULTS_HTML = (vm: ValidatorAppVM) => html`
    ${vm.searchResults.map(result => html`<div class="search-result" @click="${selectResult(vm, result.url)}"><div class="icon">${IMAGE_HTML(result.artwork)}</div><div class="title">${result.title}</div><div class="author">${result.author}</div></div>`)}`;

const IMAGE_HTML = (artwork?: string) => artwork ? html`<img src=${artwork}>` : SQUARE_ICON;

function selectResult(vm: ValidatorAppVM, url: string): () => void {
    return () => vm.continueWith(url);
}
