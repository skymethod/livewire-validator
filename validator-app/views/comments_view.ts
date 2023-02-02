import { html, css, unsafeCSS, Theme, LitElement, isOauthObtainTokenResponse, Threadcap, CommentsResult } from '../deps_app.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';
import { ERROR_ICON, PERSON_ICON } from './icons.ts';
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

.comment div.icon {
    display: flex;
    align-items: center;
    justify-content: center;
}

.comment div.icon svg {
    width: 24px;
    height: 24px;
}

.comment div.error.icon svg {
    fill: ${unsafeCSS(Theme.textColorErrorHex)};
}

.comment div.default.icon svg {
    fill: ${unsafeCSS(Theme.textColorSecondaryHex)};
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

details.error {
    color: ${unsafeCSS(Theme.textColorErrorHex)};
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
    margin-top: 0.5rem;
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
        const results = vm.commentsResults;
        commentsDetails.style.display = results ? 'block' : 'none';
        commentsSubjectSpan.textContent = results && results[0] ? results && results[0].subject : 'subject';
        if (results !== _renderedResults) {
            renderComments(results, commentsOutput, vm);
            _renderedResults = results;
        }
    };
}

//

let _renderedResults: CommentsResult[] | undefined;

function renderComments(results: CommentsResult[] | undefined, commentsOutput: HTMLOutputElement, vm: ValidatorAppVM) {
    while (commentsOutput.firstChild) commentsOutput.removeChild(commentsOutput.firstChild);
    if (results) {
        for (const result of results) {
            for (const root of result.threadcap.roots) {
                renderNode(root, result.threadcap, commentsOutput, 0, vm);
            }
        }
    }
}

function renderNode(nodeId: string, threadcap: Threadcap, containerElement: HTMLElement, level: number, vm: ValidatorAppVM) {
    const node = threadcap.nodes[nodeId];
    if (!node) return;
    
    const { comment, commentError, repliesError } = node;
    
    const commentDiv = document.createElement('div');
    commentDiv.classList.add('comment');
    if (level > 0) commentDiv.style.marginLeft = `${level * 4}em`;

    const commenter = comment ? threadcap.commenters[comment.attributedTo] : undefined;

    if (comment && commenter?.icon?.url) {
        const iconImg = document.createElement('img');
        iconImg.classList.add('icon');
        iconImg.src = commenter.icon.url;
        commentDiv.appendChild(iconImg);
    } else {
       const iconDiv = document.createElement('div');
       iconDiv.classList.add('icon', commentError ? 'error' : 'default');
       iconDiv.innerHTML = (commentError ? ERROR_ICON : PERSON_ICON).getHTML();
       commentDiv.appendChild(iconDiv);
    }
    
    const rhsDiv = document.createElement('div');
    rhsDiv.classList.add('rhs');

    const headerDiv = document.createElement('div');
    headerDiv.classList.add('header');

    if (comment) {
        const attributedToDiv = document.createElement('div');
        attributedToDiv.classList.add('attributed-to');
        if (commenter) {
            let name = commenter.name;
            if (commenter.fqUsername) name += ' ' + commenter.fqUsername;
            if (commenter.url) {
                const a = document.createElement('a');
                a.href = commenter.url || '#';
                a.target = '_blank';
                a.textContent = name;
                attributedToDiv.appendChild(a);
            } else {
                attributedToDiv.appendChild(document.createTextNode(name));
            }
           
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
    } else if (commentError) {
        const nodeAnchor = document.createElement('a');
        nodeAnchor.href = nodeId;
        nodeAnchor.innerText = nodeId;
        externalizeAnchor(nodeAnchor);
        headerDiv.appendChild(nodeAnchor);
    }
    rhsDiv.appendChild(headerDiv);

    const renderError = (error: string) => {
        const lines = error.split('\n');
        const summary = lines[0];
        const errorDetails = document.createElement('details');
        errorDetails.classList.add('error');
        const errorSummary = document.createElement('summary');
        errorSummary.textContent = summary;
        errorDetails.appendChild(errorSummary);
        errorDetails.append(document.createTextNode(lines.slice(1).join('\n')))
        rhsDiv.appendChild(errorDetails);
    }

    if (comment) {
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = Object.values(comment.content)[0];
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

        if (comment.url && threadcap.protocol === 'activitypub') {
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
    } else if (commentError) {
        renderError(commentError);
    }
    if (repliesError) {
        renderError(repliesError);
    }

    commentDiv.appendChild(rhsDiv);

    containerElement.appendChild(commentDiv);

    for (const reply of node.replies || []) {
        renderNode(reply, threadcap, containerElement, level + 1, vm);
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

        const loginAnchor = fieldsetContainer.getElementsByTagName('a')[0] as HTMLAnchorElement;
        const textarea = fieldsetContainer.getElementsByTagName('textarea')[0] as HTMLTextAreaElement;
        const button = fieldsetContainer.getElementsByTagName('button')[0] as HTMLButtonElement;
        const output = fieldsetContainer.getElementsByTagName('output')[0] as HTMLOutputElement;
        const outputAnchor = output.getElementsByTagName('a')[0] as HTMLAnchorElement;

        const origin = new URL(replyToUrl).origin;
        outputAnchor.textContent = origin;

        let sent = false;
        let newReplyUrl: string | undefined;

        const update = () => {
            const loggedIn = vm.isLoggedIn(origin);
            loginAnchor.textContent = loggedIn ? `Sign out of ${origin}` : `Sign in at ${origin}...`;
            loginAnchor.style.display = !sent ? 'block' : 'none';
            textarea.style.display = button.style.display = loggedIn && !sent ? 'block': 'none';
            output.style.display = sent ? 'block' : 'none';
            outputAnchor.href = newReplyUrl || origin;
        }

        loginAnchor.onclick = e => {
            e.preventDefault();
            
            const loggedIn = vm.isLoggedIn(origin);
            if (loggedIn) {
                vm.expireLogin(origin);
                update();
            } else {
                // start login flow in a another tab, listen for a message to close it
                const w = window.open(`/login?origin=${encodeURIComponent(origin)}`, 'login');
                if (w) {
                    globalThis.onmessage = e => {
                        const { data } = e;
                        console.log('onmessage', data);
                        if (typeof data.origin === 'string' && isOauthObtainTokenResponse(data.tokenResponse)) {
                            vm.acceptLogin(data.origin, data.tokenResponse);
                            update();
                            w.close();
                        }
                    }
                }
            }
        };

        button.onclick = async e => {
            e.preventDefault();
            newReplyUrl = await vm.sendReply(textarea.value.trim(), replyToUrl);
            sent = true;
            anchor.textContent = 'Close ⅹ';
            update();
        };

        update();
        textarea.focus();
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
    <output>Reply sent! It may take a while to appear here, but you can view it over at <a href="#" target="_blank" rel="noreferrer noopener nofollow">(origin)</a></output>
</fieldset>
`;
