import { html, css, unsafeCSS, Comment, Commenter, Theme, LitElement } from '../deps_app.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';
import { FetchCommentsResult } from '../comments.ts';
import { externalizeAnchor } from './util.ts';

export const COMMENTS_HTML = html`
<details id="comments-details" open>
    <summary>Comments for <span id="comments-subject">subject</span></summary>
    <output id="comments"></output>
</details>
`;

export const COMMENTS_CSS = css`

#comments-details {
    display: none;
    font-size: 0.75rem;
    color: ${unsafeCSS(Theme.textColorHex)};
    margin-bottom: 1rem;
    max-width: 100%;
    overflow: hidden;
}

.comment {
    display: flex;
    max-width: 80ch;
    line-height: 1.5;
}

.comment .icon {
    width: 3em;
    height: 3em;
    border-radius: 0.5em;
    margin: 0.75em 1em 1em 0;
}

.comment .rhs {
    display: flex;
    flex-direction: column;
    margin: 0.75em 1em 0 0;
    flex-grow: 1;
}

.comment .header {
    display: flex;
    gap: 0.5em;
    align-items: baseline;
    color: ${unsafeCSS(Theme.textColorSecondaryHex)};
}

.comment .header .url {
    color: ${unsafeCSS(Theme.textColorSecondaryHex)};
}

.comment .rhs p {
    margin-block-start: 0em;
    margin-block-end: 0em;
}

.comment img {
    max-width: 80ch;
    width: auto;
    height: auto;
}

.reply fieldset {
    display: flex;
    flex-direction: column;
    border: solid 1px ${unsafeCSS(Theme.textColorSecondaryHex)};
} 

.reply textarea {
    width: 100%;
    color: ${unsafeCSS(Theme.textColorHex)};
    background-color: ${unsafeCSS(Theme.backgroundColorHex)};
}

.reply button {
    padding: 0.25rem 2rem;
    align-self: flex-end;
    margin: 0.5rem 0;
}

`;

export function initComments(document: Document, vm: ValidatorAppVM): () => void {
    const commentsDetails = document.getElementById('comments-details') as HTMLDetailsElement;
    const commentsSubjectSpan = document.getElementById('comments-subject') as HTMLSpanElement;
    const commentsOutput = document.getElementById('comments') as HTMLOutputElement;
    return () => {
        const result = vm.fetchCommentsResult;
        commentsDetails.style.display = result ? 'block' : 'none';
        commentsSubjectSpan.textContent = result?.subject || 'subject';
        if (result !== _renderedResult) {
            renderComments(result, commentsOutput, vm);
            _renderedResult = result;
        }
    };
}

//

let _renderedResult: FetchCommentsResult | undefined;

function renderComments(result: FetchCommentsResult | undefined, commentsOutput: HTMLOutputElement, vm: ValidatorAppVM) {
    while (commentsOutput.firstChild) commentsOutput.removeChild(commentsOutput.firstChild);
    if (result) renderNode(result.rootComment, result.commenters, commentsOutput, 0, vm);
}

function renderNode(comment: Comment, commenters: ReadonlyMap<string, Commenter>, containerElement: HTMLElement, level: number, vm: ValidatorAppVM) {
    const commenter = comment.attributedTo ? commenters.get(comment.attributedTo) : undefined;
    
    const commentDiv = document.createElement('div');
    commentDiv.classList.add('comment');
    if (level > 0) commentDiv.style.marginLeft = `${level * 4}em`;

    const iconImg = document.createElement('img');
    iconImg.classList.add('icon');
    iconImg.src = commenter && commenter.icon ? commenter.icon.url : '#';
    commentDiv.appendChild(iconImg);

    const rhsDiv = document.createElement('div');
    rhsDiv.classList.add('rhs');
    
    const headerDiv = document.createElement('div');
    headerDiv.classList.add('header');

    const attributedToDiv = document.createElement('div');
    attributedToDiv.classList.add('attributed-to');
    if (commenter) {
        const a = document.createElement('a');
        a.href = commenter.url;
        a.target = '_blank';
        a.textContent = commenter.name + ' ' + commenter.fqUsername;
        attributedToDiv.appendChild(a);
    } else {
        attributedToDiv.appendChild(document.createTextNode(comment.attributedTo || '<unknown>'));
    }
    headerDiv.appendChild(attributedToDiv);

    const ageText = document.createTextNode(comment.published ? computeAge(new Date(comment.published)) : '');
    if (comment.url) {
        const ageAnchor = document.createElement('a');
        ageAnchor.classList.add('url');
        ageAnchor.href = comment.url;
        externalizeAnchor(ageAnchor);
        ageAnchor.appendChild(ageText);
        headerDiv.appendChild(ageAnchor);
    } else {
        headerDiv.appendChild(ageText);
    }
    
    rhsDiv.appendChild(headerDiv);

    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = comment.content;
    contentDiv.querySelectorAll('a').forEach(externalizeAnchor);
    rhsDiv.appendChild(contentDiv);

    for (const attachment of comment.attachments) {
        const attachmentDetails = document.createElement('details');
        const summary =  document.createElement('summary');
        summary.textContent = `Attachment (${attachment.mediaType})`;
        attachmentDetails.appendChild(summary);
        const img = document.createElement('img');
        img.src = attachment.url;
        if (attachment.width && attachment.height) {
            img.width = attachment.width;
            img.height = attachment.height;
        }
        attachmentDetails.appendChild(img);
        rhsDiv.appendChild(attachmentDetails);
    }

    if (comment.url) {
        const replyToUrl = comment.url;
        const replyDiv = document.createElement('div');
        replyDiv.className = 'reply';
        const replyAnchor = document.createElement('a');
        replyAnchor.textContent = "Reply →";
        replyAnchor.href = '#';
        replyDiv.appendChild(replyAnchor);
        const replyFieldsetContainer = document.createElement('div');
        replyDiv.appendChild(replyFieldsetContainer);
        replyAnchor.onclick = e => {
            e.preventDefault();
            toggleReplyBox(replyAnchor, replyFieldsetContainer, replyToUrl, vm);
        };
        rhsDiv.appendChild(replyDiv);
    }

    commentDiv.appendChild(rhsDiv);

    containerElement.appendChild(commentDiv);

    for (const reply of comment.replies) {
        renderNode(reply, commenters, containerElement, level + 1, vm);
    }
}

function computeAge(date: Date): string {
    const millis = Date.now() - date.getTime();
    const seconds = millis / 1000;
    const minutes = seconds / 60;
    if (minutes < 60) return `${Math.max(Math.floor(minutes), 1)}m`;
    const hours = minutes / 60;
    if (hours < 24) return `${Math.floor(hours)}h`;
    const days = hours / 24;
    return `${Math.floor(days)}d`;
}

function toggleReplyBox(anchor: HTMLAnchorElement, fieldsetContainer: HTMLDivElement, replyToUrl: string, vm: ValidatorAppVM) {
    if (anchor.textContent?.startsWith('Reply')) {
        anchor.textContent = 'Cancel ⅹ';
        LitElement.render(REPLY_BOX, fieldsetContainer);

        const a = fieldsetContainer.getElementsByTagName('a')[0] as HTMLAnchorElement;
        const textarea = fieldsetContainer.getElementsByTagName('textarea')[0] as HTMLTextAreaElement;
        const button = fieldsetContainer.getElementsByTagName('button')[0] as HTMLButtonElement;

        const origin = new URL(replyToUrl).origin;
        a.textContent = `Login at ${origin}...`
        a.onclick = e => {
            e.preventDefault();
            
            const w = window.open(`/login?origin=${encodeURIComponent(origin)}`, 'login');
            if (w) {
                globalThis.onmessage = e => {
                    const { data } = e;
                    console.log('onmessage', data);                    
                    if (data.origin && data.tokenResponse) {
                        // TODO save token locally to log in
                        w.close();
                    }
                }
            }
        };

        let loggedIn = false; // TODO
        const update = () => {
            a.style.display = loggedIn ? 'none' : 'block';
            textarea.style.display = button.style.display = loggedIn ? 'block': 'none';
        }
        update();

    } else {
        LitElement.render(undefined, fieldsetContainer);
        anchor.textContent = "Reply →";
      
    }
}

const REPLY_BOX = html`
<fieldset>
    <legend>Reply</legend>
    <a href="#">Login to ...</a>
    <textarea type="text" name="content" rows="4" placeholder="Your reply..."></textarea>
    <button type="submit">Send</button>
</fieldset>
`;
