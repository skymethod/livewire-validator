import { html, css } from '../deps_app.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';

export const FORM_HTML = html`
<form id="input">
    <input id="feed-url" type="text" placeholder="Feed url" autocomplete="on" required>
    <button id="submit" type="submit">Validate</button>
</form>
<output id="status"></output>
`;

export const FORM_CSS = css`

#input {
    display: flex;
}

#feed-url {
    font-size: 1rem;
    padding: 0.5rem;
    flex-grow: 1;
}

#input button {
    padding: 0.5rem 1rem;
}

`;

export function initForm(document: HTMLDocument, vm: ValidatorAppVM): () => void {
    const inputForm = document.getElementById('input') as HTMLFormElement;
    const feedUrlInput = document.getElementById('feed-url') as HTMLInputElement;
    const submitButton = document.getElementById('submit') as HTMLButtonElement;
    const statusOutput = document.getElementById('status') as HTMLOutputElement;

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
        statusOutput.textContent = vm.status;
        submitButton.textContent = vm.validating ? 'Cancel' : 'Validate';
    };
}
