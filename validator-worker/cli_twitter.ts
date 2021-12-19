import { join } from './deps_cli.ts';

export async function twitter(args: (string | number)[], _options: Record<string, unknown>) {
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

//

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
