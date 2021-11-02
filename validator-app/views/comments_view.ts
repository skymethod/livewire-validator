import { html, css } from '../deps_app.ts';
import { ValidatorAppVM } from '../validator_app_vm.ts';
import { Comment, Commenter, FetchCommentsResult } from '../comments.ts';

export const COMMENTS_HTML = html`
<output id="comments"></output>
`;

export const COMMENTS_CSS = css`

.comment {
    display: flex;
}

.comment .icon {
    width: 3rem;
    height: 3rem;
    border-radius: 0.5rem;
    margin: 1rem;
}

.comment .rhs {
    display: flex;
    flex-direction: column;
    margin: 1rem 1rem 0 0;
}

.comment .rhs p {
    margin-block-start: 0.5rem;
    margin-block-end: 0.5rem;
    line-height: 1.4;
}

`;

export function initComments(document: Document, vm: ValidatorAppVM): () => void {
    const commentsOutput = document.getElementById('comments') as HTMLOutputElement;
    return () => {
        const result = vm.fetchCommentsResult;
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
    if (level > 0) commentDiv.style.marginLeft = `${level * 4}rem`;

    const iconImg = document.createElement('img');
    iconImg.classList.add('icon');
    iconImg.src = commenter ? commenter.icon.url : '#';
    commentDiv.appendChild(iconImg);

    const rhsDiv = document.createElement('div');
    rhsDiv.classList.add('rhs');
    
    const attributedToDiv = document.createElement('div');
    if (commenter) {
        const a = document.createElement('a');
        a.href = commenter.url;
        a.target = '_blank';
        a.textContent = commenter.name + ' ' + commenter.fqUsername;
        attributedToDiv.appendChild(a);
    } else {
        attributedToDiv.appendChild(document.createTextNode(comment.attributedTo));
    }
    rhsDiv.appendChild(attributedToDiv);

    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = comment.content;
    rhsDiv.appendChild(contentDiv);

    commentDiv.appendChild(rhsDiv);

    containerElement.appendChild(commentDiv);

    for (const reply of comment.replies) {
        renderNode(reply, commenters, containerElement, level + 1);
    }
}
