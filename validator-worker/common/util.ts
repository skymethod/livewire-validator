// workaround for https://github.com/microsoft/TypeScript/issues/17002

// deno-lint-ignore no-explicit-any
export function isReadonlyArray(arg: any): arg is readonly any[] {
    return Array.isArray(arg);
}

// common fetch helpers

export const isRedirectStatus = (status: number) => status === 301 || status === 302 || status === 307 || status === 308;

export type UrlStatus = { url: string, status: number };

export async function fetchWithUrlStatuses(url: string, headers?: Record<string, string>, urlStatuses?: UrlStatus[], onResponse?: (res: Response) => void): Promise<Response> {
    const redirect = urlStatuses ? 'manual' : 'follow';
    while (true) {
        const res = await fetch(url, { headers, redirect });
        if (onResponse) onResponse(res);
        const { status, type } = res;
        if (urlStatuses && redirect === 'manual') {
            if (status === 0 && type === 'opaqueredirect') throw new Error(`Opaque redirect response for ${url}`);
            urlStatuses.push({ url, status });
            if (isRedirectStatus(status)) {
                const location = res.headers.get('location') ?? '';
                if (location === '') throw new Error(`Expected 'location' header in ${status} response`);
                const newUrl = new URL(location, url).toString();
                if (urlStatuses.some(v => v.url === newUrl)) throw new Error(`Redirect loop: ${newUrl}`);
                if (urlStatuses.length >= 10) throw new Error(`Redirected ${urlStatuses.length} times`);
                url = newUrl;
            } else {
                return res;
            }
        } else {
            return res;
        }
    }
}
