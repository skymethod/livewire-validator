import { html, css, unsafeCSS } from '../deps_app.ts';
import { StaticData } from '../static_data.ts';
import { Theme } from '../theme.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';
import { CHECKLIST_ICON } from './icons.ts';

export const FORM_HTML = html`
<header>${CHECKLIST_ICON}<h1>Livewire Podcast Validator <span id="version">v0.2</span></h1></header>
<form id="form">
    <input id="text-input" type="text" placeholder="Podcast feed url, ActivityPub url, or search text" autocomplete="url" required>
    <button id="submit" type="submit">Validate</button>
</form>
`;

export const FORM_CSS = css`

header {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: ${unsafeCSS(Theme.textColorHex)};
    margin-bottom: 1rem;
    opacity: 0.75;
}

header h1 {
    margin: 0;
}

header svg {
    transform: scale(1.5);
    fill: currentColor;
}

#version {
    opacity: 0.25;
}

#form {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
}

#text-input {
    font-size: 1rem;
    flex-grow: 1;
    padding: 0 0.5rem;
    background-color: inherit;
    border: solid 1px white;
    outline: none;
    color: ${unsafeCSS(Theme.textColorHex)};
}

#text-input:read-only {
    opacity: 0.5; 
}

input:-webkit-autofill, input:-webkit-autofill:focus {
    transition: background-color 600000s 0s, color 600000s 0s;
}

#form button {
    padding: 0.5rem 1rem;
    min-width: 8rem;
}

`;

export function initForm(document: Document, vm: ValidatorAppVM, staticData: StaticData): () => void {
    const form = document.getElementById('form') as HTMLFormElement;
    const textInput = document.getElementById('text-input') as HTMLInputElement;
    const submitButton = document.getElementById('submit') as HTMLButtonElement;
    const versionSpan = document.getElementById('version') as HTMLSpanElement;

    const version = [staticData.version, staticData.pushId].map(v => (v || '').trim()).filter(v => v.length > 0).join('.');
    versionSpan.textContent = staticData.version ? `v${version}` : '';

    const { searchParams } = new URL(document.URL);
    const validate = searchParams.get('validate') || undefined;
    const input = searchParams.get('input') || undefined;
    const nocomments = searchParams.has('nocomments');
    const startValidation = () => vm.startValidation(textInput.value, { validateComments: !nocomments });
    form.onsubmit = e => {
        e.preventDefault();
        if (vm.validating) {
            vm.cancelValidation();
        } else {
            startValidation();
        }
    }
    vm.onSelectResult = url => {
        textInput.value = url;
        startValidation();
    };
    
    if (validate) {
        textInput.value = validate;
        setTimeout(startValidation, 0);
    } else if (input) {
        textInput.value = input;
    }
    textInput.focus();

    return () => {
        const wasDisabled = textInput.disabled;
        textInput.disabled = vm.validating;
        textInput.readOnly = vm.validating;
        submitButton.textContent = vm.validating ? 'Cancel' : 'Validate';
        if (wasDisabled && !textInput.disabled) {
            textInput.focus();
        }
    };
}
