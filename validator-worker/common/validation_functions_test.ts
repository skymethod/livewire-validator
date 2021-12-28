import { assert } from 'https://deno.land/std@0.119.0/testing/asserts.ts';
import { isPodcastImagesSrcSet } from './validation_functions.ts';

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
