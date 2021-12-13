import { basename, dirname, join, fromFileUrl, resolve, ModuleWatcher, Bytes, parseFlags } from './deps_cli.ts';
import { accountsVerifyCredentials, appsCreateApplication, computeOauthUserAuthorizationUrl, instanceInformation, oauthObtainToken } from './mastodon_api.ts';

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
    const fn = { build, b64, twitter, mastodon }[command];
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

async function build(_args: (string | number)[], options: Record<string, unknown>) {
    const thisPath = fromFileUrl(import.meta.url);
    const validatorWorkerPath = dirname(thisPath);
    const validatorAppPath = resolve(validatorWorkerPath, '../validator-app');
    const appPath = join(validatorAppPath, 'validator_app.ts');
    const dataPath = join(validatorWorkerPath, 'validator_data.ts');
    const localDataPath = join(validatorWorkerPath, 'validator_local_data.ts');

    const regenerateAppContents = async () => {
        console.log(`bundling ${basename(appPath)} into bundle.js...`);
        try {
            const start = Date.now();
            const result = await Deno.emit(appPath, { bundle: 'module', compilerOptions: {
                lib: ['esnext', 'dom'],
            } });
            console.log(`bundle finished in ${Date.now() - start}ms`);
        
            if (result.diagnostics.length > 0) {
                console.warn(Deno.formatDiagnostics(result.diagnostics));
                return;
            }
        
            await updateFile(result, dataPath, 'bundle.js', `VALIDATOR_APP`);
            if (options.sourcemaps) await updateFile(result, localDataPath, 'bundle.js.map', `VALIDATOR_APP_MAP`);

        } catch (e) {
            console.warn('error in regenerateAppContents', e.stack || e);
        }   
    }

    await regenerateAppContents();
    const _moduleWatcher = new ModuleWatcher(appPath, regenerateAppContents);

    return new Promise((_resolve, _reject) => {

    });
}

async function updateFile(result: Deno.EmitResult, dataPath: string, name: string, constantPrefix: string) {
    const contentsStr = result.files[`deno:///${name}`];
    if (typeof contentsStr !== 'string') throw new Error(`${name} not found in bundle output files: ${Object.keys(result.files).join(', ')}`);
   
    const bytes = Bytes.ofUtf8(contentsStr);
    const sha1 = await bytes.sha1();
    await updateData(`${constantPrefix}_B64`, bytes.base64(), dataPath);
    await updateData(`${constantPrefix}_HASH`, sha1.hex(), dataPath);
}

async function updateData(name: string, value: string, dataPath: string) {
    const oldText = await Deno.readTextFile(dataPath);
    const newText = oldText.replaceAll(new RegExp(`export const ${name} = '.*?';`, 'g'), `export const ${name} = '${value}';`);
    if (oldText == newText) return;
    await Deno.writeTextFile(dataPath, newText);
    console.log(`Updated ${name}`);
}

async function twitter(args: (string | number)[], _options: Record<string, unknown>) {
    const tweetId = args[0];
    if (typeof tweetId !== 'string') return;

    // read bearer token from denoflare config for now
    // TODO gross
    const home = Deno.env.get('HOME');
    if (!home) return;
    const txt = await Deno.readTextFile(join(home, `.denoflare`));
    const m = /"twitterCredentials"\s*:\s*{\s*"value"\s*:\s*"bearer:(.*?)"/.exec(txt); 
    if (!m) return;
    const bearerToken = m[1];

    // https://developer.twitter.com/en/docs/twitter-api/conversation-id

    // root tweet
    await callTwitterApi(`https://api.twitter.com/2/tweets?ids=${tweetId}&tweet.fields=author_id,conversation_id,created_at,in_reply_to_user_id,referenced_tweets&expansions=author_id,in_reply_to_user_id,referenced_tweets.id&user.fields=name,username`, bearerToken);

    // conversation replies - will not return root tweet
    await callTwitterApi(`https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${tweetId}&tweet.fields=in_reply_to_user_id,author_id,created_at,conversation_id`, bearerToken);
    
}

async function callTwitterApi(url: string, bearerToken: string ) {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${bearerToken}`}});
    console.log(res);
    const body = await res.text();
    if (res.headers.get('content-type') === 'application/json; charset=utf-8') {
        console.log(JSON.stringify(JSON.parse(body), undefined, 2));
    } else {
        console.log(body);
    }
}

function computeAbsolutePath(path: string): string {
    if (path.startsWith('~/')) {
        const home = Deno.env.get('HOME');
        if (!home) throw new Error(`Expected $HOME`);
        return home + path.substring(1);
    }
    return path;
}

async function mastodon(args: (string | number)[]) {
    if (typeof args[0] !== 'string') throw new Error(`Pass the action as the first arg`);
    if (typeof args[1] !== 'string') throw new Error(`Pass the path to MastodonSecrets json as the second arg`);

    const action = args[0];
    
    const secrets = JSON.parse(await Deno.readTextFile(computeAbsolutePath(args[1]))) as MastodonSecrets;
    const { apiBase, clientName, redirectUris, redirectUri, scopes, website, clientId, clientSecret, accessToken, code } = secrets;

    // read:accounts: for /api/v1/accounts/verify_credentials
    // write:statuses: for creating new comments

    if (action === 'instance-info') {
        const res = await instanceInformation(apiBase);
        console.log(JSON.stringify(res, undefined, 2));
    }

    if (action === 'create-app') {
        const res = await appsCreateApplication(apiBase, { 
            client_name: clientName, 
            redirect_uris: redirectUris,
            scopes,
            website,
        });
        console.log(JSON.stringify(res, undefined, 2));
    }

    if (action === 'oauth-authorize-url') {
        if (!clientId) throw new Error(`clientId is required`);

        const url = computeOauthUserAuthorizationUrl(apiBase, { 
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scopes,
            force_login: true,
        });
        console.log(url);
    }

    if (action === 'oauth-obtain-token') {
        if (!clientId) throw new Error(`clientId is required`);
        if (!clientSecret) throw new Error(`clientSecret is required`);
        if (!code) throw new Error(`code is required`);

        const res = await oauthObtainToken(apiBase, {
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
            scope: scopes,
        });
        console.log(JSON.stringify(res, undefined, 2));
    }

    if (action === 'verify-credentials') {
        if (!accessToken) throw new Error(`accessToken is required`);

        const res = await accountsVerifyCredentials(apiBase, accessToken);
        console.log(JSON.stringify(res, undefined, 2));
    }
}

//

interface MastodonSecrets {
    readonly apiBase: string;
    readonly clientName: string;
    readonly redirectUris: string;
    readonly redirectUri: string;
    readonly scopes: string;
    readonly website?: string;
    readonly clientId?: string;
    readonly clientSecret?: string;
    readonly accessToken?: string;
    readonly code?: string;
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
