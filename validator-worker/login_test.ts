import { assert } from 'https://deno.land/std@0.224.0/assert/assert.ts';
import { assertMatch } from 'https://deno.land/std@0.224.0/assert/assert_match.ts';
import { computeOauthPkceCodeVerifier } from './login.ts';

Deno.test('computeOauthPkceCodeVerifier', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
        const codeVerifier = computeOauthPkceCodeVerifier();
        assertMatch(codeVerifier, /^[a-zA-Z0-9-._~]{43,128}$/);
        assert(!seen.has(codeVerifier), `Duplicate codeVerifier: ${codeVerifier}`);
        seen.add(codeVerifier);
    }
});
