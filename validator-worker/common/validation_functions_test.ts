import { assert } from 'https://deno.land/std@0.194.0/testing/asserts.ts';
import { isIso8601, isPodcastImagesSrcSet, isRfc2822 } from './validation_functions.ts';

Deno.test('isPodcastImagesSrcSet', () => {
    const good = [
`https://example.com/images/ep1/pci_avatar-massive.jpg 1500w,
https://example.com/images/ep1/pci_avatar-middle.jpg 600w,
https://example.com/images/ep1/pci_avatar-small.jpg 300w,
https://example.com/images/ep1/pci_avatar-tiny.jpg 150w`, // from pi spec\

        'https://example.com/uploads/150-marie-lloyd.jpg 1.5x, https://example.com/uploads/200-marie-lloyd.jpg 2x', // from html spec, absolute
        
        'https://example.com/images/ep1/pci_avatar-massive.jpg',
    ];

    const bad = [
        '', 'a', 'https://example.com a',
        '/uploads/150-marie-lloyd.jpg 1.5x, /uploads/200-marie-lloyd.jpg 2x', // from html spec, but relative
        'https://example.com -1w',
        'https://example.com 0w',
        'https://example.com 0.0x',
        'https://example.com 0.0x, https://example.com 0w', // if one has width, they all must
        'https://example.com, https://example.com 0w', // if one has width, they all must
        'https://example.com 234w, https://example.com 234w', // no width dups
        'https://example.com 2.30x, https://example.com 2.3x', // no density dups
        'https://example.com 1.00x, https://example.com', // no density dups, implied 1x
    ];

    for (const srcset of good) {
        assert(isPodcastImagesSrcSet(srcset), `expected good: ${srcset}`);
    }

    for (const srcset of bad) {
        assert(!isPodcastImagesSrcSet(srcset), `expected bad: ${srcset}`);
    }

});

Deno.test('isRfc2822', () => {
    const good = [
        '01 Jun 2016 14:31:46 -0700',
        'Thu, 01 Apr 2021 08:00:00 EST',
        'Tue, 15 Sep 2015 14:00:00 UTC',
    ];

    const bad = [
        '', 'a', 'thursday',
        new Date().toISOString(),
    ];

    for (const date of good) {
        assert(isRfc2822(date), `expected good: ${date}`);
    }

    for (const date of bad) {
        assert(!isRfc2822(date), `expected bad: ${date}`);
    }

});

Deno.test('isIso8601', () => {
    const good = [
        '2021-04-14T10:25:42Z',
        '2021-04-14T10:25:42.123Z',
    ];

    const bad = [
        '', 'a', 'thursday', '2021-04-14T10:25:42', '2022-04-25T01:30:00.000-0600',
    ];

    for (const date of good) {
        assert(isIso8601(date), `expected good: ${date}`);
    }

    for (const date of bad) {
        assert(!isIso8601(date), `expected bad: ${date}`);
    }

    const goodTz = [
        '2021-04-14T10:25:42Z',
        '2021-04-14T10:25:42.123Z',
        '2022-04-25T01:30:00.000-0600',
        '2022-04-25T01:30:00+06',
        '2022-04-25T01:30:00.000-12:00',
    ];

    const badTz = [
        '', 'a', 'thursday', '2021-04-14T10:25:42', '2022-04-25T01:30:00.000GMT',
    ];

    for (const date of goodTz) {
        assert(isIso8601(date, { allowTimezone: true }), `expected good: ${date}`);
    }

    for (const date of badTz) {
        assert(!isIso8601(date, { allowTimezone: true }), `expected bad: ${date}`);
    }

});
