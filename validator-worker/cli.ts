import { build } from './cli_build.ts';
import { mastodon } from './cli_mastodon.ts';
import { twitter } from './cli_twitter.ts';
import { validate } from './cli_validate.ts';
import { Bytes, parseFlags } from './deps_cli.ts';

const args = parseFlags(Deno.args, { string: '_' }); // don't auto coersce to number, twitter ids are rounded

if (args._.length > 0) {
    await validator(args._, args);
    Deno.exit(0);
}

dumpHelp();

Deno.exit(1);

//

async function validator(args: (string | number)[], options: Record<string, unknown>) {
    const command = args[0];
    const fn = { build, b64, twitter, mastodon, validate }[command];
    if (options.help || !fn) {
        dumpHelp();
        return;
    }
    await fn(args.slice(1), options);
}

async function b64(args: (string | number)[], _options: Record<string, unknown>) {
    const path = args[0];
    if (typeof path !== 'string') throw new Error('Must provide path to file');
    const contents = await Deno.readFile(path);
    const b64 = new Bytes(contents).base64();
    console.log(b64);
}

//

function dumpHelp() {
    const lines = [
        `validator-cli`,
        'Tools for developing validator',
        '',
        'USAGE:',
        '    deno run --unstable --allow-net validator-worker/cli.ts [FLAGS] [OPTIONS] [--] build',
        '    deno run --unstable --allow-net --allow-read validator-worker/cli.ts [FLAGS] [OPTIONS] [--] b64 <path>',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    build         Watch for changes in validator-app, and bundle as worker embedded resource',
        '    b64 <path>    Dump out the b64 of a given file',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
