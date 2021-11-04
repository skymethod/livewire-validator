export function externalizeAnchor(anchor: HTMLAnchorElement) {
    anchor.target = '_blank';
    anchor.rel = 'noreferrer noopener nofollow';
}
