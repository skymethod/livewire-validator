import { assert, assertEquals } from 'https://deno.land/std@0.191.0/testing/asserts.ts';
import { Fetcher, PISearchFetcher, ValidationJobVM } from './validation_job_vm.ts';

Deno.test('ValidationJobVM calls search ', () => {
    const localFetcher: Fetcher = () => { throw new Error(); };
    const remoteFetcher: Fetcher = () => { throw new Error(); };
    const piSearchFetcher: PISearchFetcher = () => { return Promise.resolve(new Response('{}')) };
    const threadcapUserAgent = 'test.ts';
    const vm = new ValidationJobVM({ threadcapUserAgent, localFetcher, remoteFetcher, piSearchFetcher });
    assert(vm.validating === false);
    assertEquals(vm.isSearch, false);
    vm.startValidation('asdf', { userAgent: 'foo', validateComments: false });
    assertEquals(vm.isSearch, true);
});
