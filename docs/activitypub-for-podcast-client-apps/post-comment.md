# Post a reply comment as a user on the episode's comment server

_A client-to-server (or c2s) ActivityPub interaction_

In this scenario, the podcast client app facilitates logging in as an authenticated user of the ActivityPub server specified in the RSS feed.

In general, this involves the following steps:
1. Fetch the root comment url specified in the RSS item `<podcast:socialInteract>` tag
2. Identify the server implementation (Mastodon/Pleroma etc)
3. Have the user log into the server using an OAuth flow
4. If server supports c2s posting, post a reply comment using the logged-in user's ActivityPub outbox url and ActivityPub standard c2s [Create Activity](https://www.w3.org/TR/activitypub/#create-activity-outbox) (if supported)
5. Else post the reply comment using the server-specific API (e.g. [Publish new status in the Mastodon REST API](https://docs.joinmastodon.org/methods/statuses/))

## Mastodon example
* Fetch the root comment url specific in the item's `podcast:socialInteract` tag (or a subcomment url) using the ActivityPub Accept header
   * The Mastodon status id encoded as the last path token in the `"id"` url of the response will be needed later
* Determine if this is Mastodon instance using [Fetch instance](https://docs.joinmastodon.org/methods/instance/)
   * It's Mastodon if the response succeeds, returns an [instance](https://docs.joinmastodon.org/entities/instance/) payload as json, and the `"version"` does not contain `Pleroma`
* Register your client app with the Mastodon server using [Create an application](https://docs.joinmastodon.org/methods/apps/)
   * Use a minimal OAuth scope such as: `read:accounts write:statuses`
   * Only needs to be done once per server
* Compute the OAuth login url using [Authorize a user](https://docs.joinmastodon.org/methods/apps/oauth/#authorize-a-user)
   * After logging in, the user will be redirected to the callback you specified
* Use the `code` returned to [Obtain an Access Token](https://docs.joinmastodon.org/methods/apps/oauth/#obtain-a-token)
* Verify the Access Token using [Verify account credentials](https://docs.joinmastodon.org/methods/accounts/)
   * If valid, you'll receive an [Account](https://docs.joinmastodon.org/entities/account/) payload
   * You can now publish statuses on behalf of the logged-in user
* Post the reply comment with [Publish new status](https://docs.joinmastodon.org/methods/statuses/)
   * Set `content` to the reply comment content from your UI
   * Set `in_reply_to_id` to the Mastodon root comment (or subcomment) status id obtained earlier
  