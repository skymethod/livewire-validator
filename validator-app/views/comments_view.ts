import { html, css, unsafeCSS } from '../deps_app.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';
import { Comment, Commenter, FetchCommentsResult } from '../comments.ts';
import { Theme } from '../theme.ts';

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
}

#comments {
    max-width: 80ch;
}

.comment {
    display: flex;
}

.comment .icon {
    width: 3em;
    height: 3em;
    border-radius: 0.5em;
    margin: 0.75em 1em 0 0;
}

.comment .rhs {
    display: flex;
    flex-direction: column;
    margin: 0.75em 1em 0 0;
    flex-grow: 1;
}

.comment .header {
    display: flex;
}

.comment .header .attributed-to {
    flex-grow: 1;
}

.comment .rhs p {
    margin-block-start: 0.5em;
    margin-block-end: 0.5em;
    line-height: 1.4;
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
            renderComments(result, commentsOutput);
            _renderedResult = result;
        }
    };
}

//

let _renderedResult: FetchCommentsResult | undefined;

function renderComments(result: FetchCommentsResult | undefined, commentsOutput: HTMLOutputElement) {
    while (commentsOutput.firstChild) commentsOutput.removeChild(commentsOutput.firstChild);
    if (result) renderNode(result.rootComment, result.commenters, commentsOutput, 0);
}

function renderNode(comment: Comment, commenters: ReadonlyMap<string, Commenter>, containerElement: HTMLElement, level: number) {
    const commenter = commenters.get(comment.attributedTo);
    
    const commentDiv = document.createElement('div');
    commentDiv.classList.add('comment');
    if (level > 0) commentDiv.style.marginLeft = `${level * 4}em`;

    const iconImg = document.createElement('img');
    iconImg.classList.add('icon');
    iconImg.src = commenter ? commenter.icon.url : '#';
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
        attributedToDiv.appendChild(document.createTextNode(comment.attributedTo));
    }
    headerDiv.appendChild(attributedToDiv);

    const ageDiv = document.createElement('div');
    ageDiv.appendChild(document.createTextNode(computeAge(new Date(comment.published))));
    headerDiv.appendChild(ageDiv);

    rhsDiv.appendChild(headerDiv);

    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = comment.content;
    rhsDiv.appendChild(contentDiv);

    commentDiv.appendChild(rhsDiv);

    containerElement.appendChild(commentDiv);

    for (const reply of comment.replies) {
        renderNode(reply, commenters, containerElement, level + 1);
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
