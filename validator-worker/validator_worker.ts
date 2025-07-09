import { Bytes, computeSystemActorResponse, computeWebfingerResponse, computeWebfingerSubject, DurableObjectNamespace, importText, IncomingRequestCf } from './deps_worker.ts';
import { FAVICON_SVG, FAVICON_ICO_B64, FAVICON_VERSION } from './favicons.ts';
import { TWITTER_IMAGE_VERSION, TWITTER_IMAGE_PNG_B64 } from './twitter.ts';
import type { AppManifest } from './app_manifest.d.ts';
import type { ValidatorWorkerEnv } from './validator_worker_env.d.ts';
import { Theme } from './common/theme.ts';
import { PodcastIndexCredentials, search } from './search.ts';
import { computeLogin } from './login.ts';
import { Storage } from './storage.ts';
import { computeFetch } from './fetch.ts';
export { StorageDO } from './storage_do.ts';

const appJs = await importText(import.meta.url, './static/app.js');
const appJsSha1 = await importText(import.meta.url, './static/app.js.sha1');

const appJsMap = await importText(import.meta.url, './static/app.js.map');
const appJsMapSha1 = await importText(import.meta.url, './static/app.js.map.sha1');

export default {

    async fetch(request: IncomingRequestCf, env: ValidatorWorkerEnv): Promise<Response> {
        console.log(`version: ${[env.version, env.pushId].filter(v => v !== undefined).join('-')}`);
        const url = new URL(request.url);
        const { pathname, searchParams } = url;
        const { cfAnalyticsToken, origin } = env;

        const actorUsername = 'system';
        const actorSubject = origin ? computeWebfingerSubject({ origin, actorUsername }) : undefined;
        const actorPathname = '/actor';

        if (pathname === '/') {
            const { version, flags, twitter, pushId } = env;
            const headers = computeHeaders('text/html; charset=utf-8');
            return new Response(computeHtml(url, { version, flags, twitter, pushId, cfAnalyticsToken }), { headers });
        } else if (pathname === computeAppJsPath()) {
            return computeAppResponse();
        } else if (pathname === computeAppSourcemapPath()) {
            return computeAppSourcemapResponse();
        } else if (pathname === FAVICON_SVG_PATHNAME) {
            const headers = computeHeaders(SVG_MIME_TYPE, { immutable: true });
            return new Response(FAVICON_SVG, { headers });
        } else if (pathname === '/favicon.ico' || pathname === FAVICON_ICO_PATHNAME) {
            const headers = computeHeaders('image/x-icon', { immutable: pathname.includes(`${FAVICON_VERSION}.`) });
            return new Response(Bytes.ofBase64(FAVICON_ICO_B64).array(), { headers });
        } else if (pathname === MANIFEST_PATHNAME) {
            const headers = computeHeaders('application/manifest+json', { immutable: true });
            return new Response(JSON.stringify(computeManifest(), undefined, 2), { headers });
        } else if (pathname === TWITTER_IMAGE_PNG_PATHNAME) {
            const headers = computeHeaders('image/png', { immutable: true });
            return new Response(Bytes.ofBase64(TWITTER_IMAGE_PNG_B64).array(), { headers });
        } else if (pathname === '/robots.txt') {
            const headers = computeHeaders('text/plain; charset=utf-8');
            return new Response('User-agent: *\nDisallow:\n', { headers });
        } else if (/^\/f(\/.*)?$/.test(pathname)) {
            const { twitterCredentials, actorKeyId, actorPrivatePemText } = env;
            return await computeFetch(request, { twitterCredentials, actorKeyId, actorPrivatePemText });
        } else if (pathname === '/s') {
            return await computeSearch(request, computePodcastIndexCredentials(env.piCredentials));
        } else if (pathname === '/login') {
            const { mastodonClientName, mastodonClientUrl, storageNamespace, origin } = env;
            if (mastodonClientName && mastodonClientUrl && storageNamespace && origin) {
                const storage = makeStorage(storageNamespace, 'oauth');
                return await computeLogin(request, url, storage, { applicationOpts: { 
                    client_name: mastodonClientName,
                    redirect_uris: `${origin}/login`,
                    scopes: 'read:accounts write:statuses',
                    website: mastodonClientUrl,
                }});
            }
        } else if (pathname === actorPathname && origin) {
            const { actorPublicPemText } = env;
            if (actorPublicPemText) {
                const { body, contentType } = computeSystemActorResponse({ origin, actorUsername, actorPathname, url: origin, publicKeyPem: actorPublicPemText });
                return new Response(JSON.stringify(body, undefined, 2), { headers: { 'content-type': contentType } });
            }
        } else if (pathname === `/.well-known/webfinger` && origin) {
            const resource = searchParams.get('resource') ?? undefined;
            if (resource === actorSubject) {
                const { body, contentType } = computeWebfingerResponse({ origin, actorUsername, actorPathname });
                return new Response(JSON.stringify(body, undefined, 2), { headers: { 'content-type': contentType } });
            }
        }
        
        const headers = computeHeaders('text/html; charset=utf-8');
        return new Response(computeNotFound({ cfAnalyticsToken }), { status: 404, headers });
    }

};

//

const MANIFEST_VERSION = '1';
const FAVICON_SVG_PATHNAME = `/favicon.${FAVICON_VERSION}.svg`;
const FAVICON_ICO_PATHNAME = `/favicon.${FAVICON_VERSION}.ico`;
const MANIFEST_PATHNAME = `/app.${MANIFEST_VERSION}.webmanifest`;
const TWITTER_IMAGE_PNG_PATHNAME = `/og-image.${TWITTER_IMAGE_VERSION}.png`;
const SVG_MIME_TYPE = 'image/svg+xml';

function makeStorage(storageNamespace: DurableObjectNamespace, durableObjectName: string): Storage {
    const fetchFromStorageDO = async (url: URL) => {
        return await storageNamespace.get(storageNamespace.idFromName(durableObjectName)).fetch(url.toString(), { headers: { 'do-name': durableObjectName }});
    };

    return {
        get: async key => {
            const url = new URL('https://do/get')
            url.searchParams.set('key', key);
            const response = await fetchFromStorageDO(url);
            return response.status === 200 ? await response.text() : undefined;
        },
        set: async (key, value) => {
            const url = new URL('https://do/set')
            url.searchParams.set('key', key);
            url.searchParams.set('value', value);
            const response = await fetchFromStorageDO(url);
            if (response.status !== 200) throw new Error(`Unexpected status ${response.status}, expected 200 from DO set operation. body=${await response.text()}`);
        },
        delete: async key => {
            const url = new URL('https://do/delete')
            url.searchParams.set('key', key);
            const response = await fetchFromStorageDO(url);
            if (response.status !== 200) throw new Error(`Unexpected status ${response.status}, expected 200 from DO set operation. body=${await response.text()}`);
        },
    }
}

async function computeSearch(request: Request, podcastIndexCredentials: PodcastIndexCredentials | undefined): Promise<Response> {
    try {
        if (request.method !== 'POST') throw new Error(`Bad method: ${request.method}`);
        const { input, headers } = await request.json();
        const result = await search(input, { headers, podcastIndexCredentials });
        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json; charset=utf-8' }});
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 400 });
    }
}

function computePodcastIndexCredentials(str: string | undefined): PodcastIndexCredentials | undefined {
    const m = /^(.+?):(.+?)$/.exec(str || '');
    return m ? { apiKey: m[1], apiSecret: m[2] } : undefined;
}

function computeManifest(): AppManifest {
    const name = 'Livewire Podcast Validator';
    return {
        'short_name': name,
        name,
        description: 'Podcast feed and media validator, including podcast namespace tags.',
        icons: [
            { 
                src: FAVICON_SVG_PATHNAME,
                type: SVG_MIME_TYPE,
            },
        ],
        'theme_color': Theme.primaryColor300Hex,
        'background_color': Theme.backgroundColorHex,
        display: 'standalone',
        start_url: '/',
        lang: 'en-US',
        dir: 'ltr',
    };
}

function computeHeaders(contentType: string, opts: { immutable?: boolean } = {}) {
    const { immutable } = opts;
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    if (immutable) headers.set('Cache-Control', 'public, max-age=604800, immutable');
    return headers;
}

function computeAppJsPath(): string {
    return `/app.${appJsSha1.trim()}.js`;
}

function computeAppSourcemapPath(): string | undefined {
    return appJsMap === '' ? undefined : `/app.${appJsMapSha1.trim()}.js.map`;
}

function computeAppResponse(): Response {
    const scriptBytes = Bytes.ofUtf8(appJs);
    const headers = computeHeaders('text/javascript; charset=utf-8', { immutable: true });
    const appSourcemapPath = computeAppSourcemapPath();
    if (appSourcemapPath) {
        const text = `//# sourceMappingURL=${appSourcemapPath}\n`  // SourceMap header alone doesn't work
            + scriptBytes.utf8();
        headers.set('SourceMap', appSourcemapPath);
        return new Response(text, { headers });
    } else {
        return new Response(scriptBytes.array(), { headers });
    }
}

function computeAppSourcemapResponse(): Response {
    const headers = computeHeaders('application/json; charset=utf-8', { immutable: true });
    return new Response(appJsMap, { headers });
}

function encodeHtml(value: string): string {
    return value.replace(/&/g, '&amp;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function computeCfAnalyticsScript(cfAnalyticsToken: unknown): string {
    return typeof cfAnalyticsToken === 'string' ? `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${cfAnalyticsToken}"}'></script><!-- End Cloudflare Web Analytics -->` : '';
}

const ICONS_MANIFEST_AND_THEME_COLORS = `
<link rel="icon" href="${FAVICON_ICO_PATHNAME}">
<link rel="icon" href="${FAVICON_SVG_PATHNAME}" type="${SVG_MIME_TYPE}">
<link rel="mask-icon" href="${FAVICON_SVG_PATHNAME}" color="${Theme.primaryColor300Hex}">
<link rel="manifest" href="${MANIFEST_PATHNAME}">
<meta name="theme-color" content="${Theme.primaryColor300Hex}" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="${Theme.primaryColor300Hex}">
`;

const COMMON_STYLES = `
body {
    font-family: ${Theme.sansSerifFontFamily};
    background-color: ${Theme.backgroundColorHex};
    color: red; /* to catch non-explicit text colors */
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

#centered {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;

    /* body2 */
    font-size: 0.875rem;
    letter-spacing: 0.01786rem;
    font-weight: normal;
    line-height: 1.25rem;

    /* medium-emphasis text */
    color: rgba(255, 255, 255, 0.60);
}
`;

const computeNotFound = ({ cfAnalyticsToken }: Record<string, unknown>) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found</title>
${ICONS_MANIFEST_AND_THEME_COLORS}
<style>
${COMMON_STYLES}
</style>
</head>
<body>
  <div id="centered">Not found</div>
  ${computeCfAnalyticsScript(cfAnalyticsToken)}
</body>
</html>`;

function computeHtml(url: URL, staticData: Record<string, unknown>) {
    const { name, description } = computeManifest();
    const { twitter, cfAnalyticsToken } = staticData;
    const title = name;
    const appJsPath = computeAppJsPath();
        return `<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>${encodeHtml(title)}</title>

<script id="static-data-script" type="application/json">${JSON.stringify(staticData)}</script>
<script type="module">
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');
</script>

<link rel="modulepreload" href="${appJsPath}" as="script" />
<script id="app-module-script" type="module" src="${appJsPath}" onload="if (!this.dataset.state) { document.documentElement.classList.remove('js'); }"></script>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
<meta name="description" content="${encodeHtml(description)}">
<meta property="og:title" content="${encodeHtml(name)}">
<meta property="og:description" content="${encodeHtml(description)}">
<meta property="og:image" content="${url.origin}${TWITTER_IMAGE_PNG_PATHNAME}">
<meta property="og:image:alt" content="${encodeHtml(name)} screenshot">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
${twitter ? `<meta name="twitter:site" content="${twitter}">` : ''}
<meta property="og:url" content="${url.origin}">
<link rel="canonical" href="${url.origin}">

${ICONS_MANIFEST_AND_THEME_COLORS}

<style>
${COMMON_STYLES}

#centered a {
    color: ${Theme.primaryColor300Hex};
    text-underline-offset: 0.2rem;
    text-decoration: none;
}

@media (hover: hover) {
    #centered a:hover {
        text-decoration: underline;
    }
}

.js #centered {
    display: none;
}

video {
    width: 100%;
    height: auto;
    outline: 4px solid rgba(255, 255, 255, 0.60);
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
}

@media only screen and (min-width: 1280px) {
    video {
        display: block;
        width: 1280px;
        margin-left: auto;
        margin-right: auto;
    }
}

</style>
</head>
<body>
  <div id="centered">
    <div>${encodeHtml(name)} requires a current version of:
      <ul>
        <li><a href="https://www.microsoft.com/en-us/edge" target="_blank">Microsoft Edge</a></li>
        <li><a href="http://www.google.com/chrome" target="_blank">Google Chrome</a></li>
        <li><a href="https://www.apple.com/safari/" target="_blank">Apple Safari</a></li>
        <li>or <a href="http://www.mozilla.com/en-US/firefox/new/" target="_blank">Mozilla Firefox</a></li>
        <li>... and <a href="https://www.enable-javascript.com/" target="_blank">JavaScript enabled</a> : )</li>
      </ul>
    </div>
  </div>
  ${computeCfAnalyticsScript(cfAnalyticsToken)}
</body>
</html>`;
}
