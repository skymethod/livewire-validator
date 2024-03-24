import { html, css, unsafeCSS, Theme } from '../deps_app.ts';
import { StaticData } from '../static_data.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';
import { CHECKLIST_ICON } from './icons.ts';

export const FORM_HTML = html`
<header>${CHECKLIST_ICON}<h1>Livewire Podcast Validator <span id="version">v0.2</span></h1></header>
<form id="form">
    <input id="text-input" type="text" spellcheck="false" placeholder="Podcast feed url, ActivityPub url, Bluesky url, Apple Podcasts url, search text (or drop a local file onto the page)" autocomplete="url" required>
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

/** ios resets */
@supports (-webkit-touch-callout: none) {
    input, textarea, button {
        -webkit-appearance: none;
        border-radius: 0;
    }

    button {
        border: solid 1px white;
    }

}

@media only screen and (max-width: 650px) {

    header {
        font-size: 66%;
        gap: 0.5rem;
    }

    header svg {
        transform: scale(1.0);
    }

    #form {
        flex-direction: column;
    }

}

@media only screen and (max-width: 500px) {

    #version {
        display: none;
    }

}

#text-input {
    font-size: 1rem;
    flex-grow: 1;
    padding: 0.5rem 0.5rem;
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

export function initForm(document: Document, vm: ValidatorAppVM, staticData: StaticData, droppedFiles: Map<string, string>): () => void {
    const form = document.getElementById('form') as HTMLFormElement;
    const textInput = document.getElementById('text-input') as HTMLInputElement;
    const submitButton = document.getElementById('submit') as HTMLButtonElement;
    const versionSpan = document.getElementById('version') as HTMLSpanElement;

    const version = [staticData.version, staticData.pushId].map(v => (v || '').trim()).filter(v => v.length > 0).join('.');
    versionSpan.textContent = staticData.version ? `v${version}` : '';

    document.ondragover = e => e.preventDefault();
    document.ondrop = async e => {
        e.preventDefault();
        try {
            const { name, text } = await getDroppedFileContents(e);
            if (!vm.validating) {
                const fileUrl = `file://(dropped)/${name}`;
                droppedFiles.set(new URL(fileUrl).toString(), text); // url encode it
                textInput.value = fileUrl;
                vm.startValidation(textInput.value, { validateComments: false, userAgent: navigator.userAgent });
            }
        } catch (e) {
            console.log('Error in getDroppedFileText', e);
        }
    };
    const { searchParams } = new URL(document.URL);
    const validate = searchParams.get('validate') || undefined;
    const input = searchParams.get('input') || undefined;
    const nocomments = searchParams.has('nocomments');
    const startValidation = () => vm.startValidation(textInput.value, { validateComments: !nocomments, userAgent: navigator.userAgent });
    form.onsubmit = e => {
        e.preventDefault();
        if (vm.validating) {
            vm.cancelValidation();
        } else {
            startValidation();
        }
    }
    
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

//

async function getDroppedFileContents(event: DragEvent): Promise<{ name: string, text: string }> {
    const files = [];
    if (event.dataTransfer) {
        if (event.dataTransfer.items) {
            for (const item of event.dataTransfer.items) {
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file instanceof File) files.push(file);
                } else {
                    throw new Error('Bad item.kind: expected file, found ' + item.kind);
                }
            }
        } else {
            for (const file of event.dataTransfer.files) {
                files.push(file);
            }
        }
    }
    if (files.length === 0) {
        throw new Error('Nothing to import');
    }
    if (files.length > 1) {
        throw new Error('Cannot import multiple files');
    }
    const text = await files[0].text();
    const name = files[0].name;
    return { name, text };
}
