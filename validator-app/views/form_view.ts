import { html, css, unsafeCSS } from '../deps_app.ts';
import { Theme } from '../theme.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';

export const FORM_HTML = html`
<form id="input">
    <input id="feed-url" type="text" placeholder="Feed or ActivityPub url" autocomplete="on" required>
    <button id="submit" type="submit">Validate</button>
</form>
`;

export const FORM_CSS = css`

#input {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
}

#feed-url {
    font-size: 1rem;
    flex-grow: 1;
    padding: 0 0.5rem;
    background-color: inherit;
    border: solid 1px white;
    outline: none;
    color: ${unsafeCSS(Theme.textColorHex)};
}

#feed-url:read-only {
    opacity: 0.5; 
}

input:-webkit-autofill, input:-webkit-autofill:focus {
    transition: background-color 600000s 0s, color 600000s 0s;
}

#input button {
    padding: 0.5rem 1rem;
    min-width: 8rem;
}

`;

export function initForm(document: Document, vm: ValidatorAppVM): () => void {
    const inputForm = document.getElementById('input') as HTMLFormElement;
    const feedUrlInput = document.getElementById('feed-url') as HTMLInputElement;
    const submitButton = document.getElementById('submit') as HTMLButtonElement;

    inputForm.onsubmit = e => {
        e.preventDefault();
        if (vm.validating) {
            vm.cancelValidation();
        } else {
            vm.validateFeed(feedUrlInput.value);
        }
    }
    feedUrlInput.focus();

    return () => {
        feedUrlInput.disabled = vm.validating;
        feedUrlInput.readOnly = vm.validating;
        submitButton.textContent = vm.validating ? 'Cancel' : 'Validate';
    };
}
