# Post a federated reply comment as a user of another ActivityPub server, not the episode's comment server

_A client-to-server (or c2s) ActivityPub interaction_

In this scenario, the podcast client app facilitates logging in as an authenticated user of an ActivityPub server that is _not_ the server specified in the RSS feed.

## Federated Pleroma example (replying to Mastodon)
* Fetch the root comment url specific in the item's `podcast:socialInteract` tag (or a subcomment url) using the ActivityPub Accept header
   * Note the `"id"` and `"conversation"` of the response
* Collect the user's desired login server from your UI
* Determine if the login server is a Pleroma instance using [Fetch instance](https://docs.joinmastodon.org/methods/instance/)
   * It's Pleroma if the response succeeds, returns an [instance](https://docs.joinmastodon.org/entities/instance/) payload as json, and the `"version"` contains `Pleroma`
* Register your client app with the Pleroma server using [Create an application](https://docs.joinmastodon.org/methods/apps/)
   * Use a minimal OAuth scope such as: `read:accounts write:statuses`
   * Only needs to be done once per server
* Compute the OAuth login url using [Authorize a user](https://docs.joinmastodon.org/methods/apps/oauth/#authorize-a-user)
   * After logging in, the user will be redirected to the callback you specified
* Use the `code` returned to [Obtain an Access Token](https://docs.joinmastodon.org/methods/apps/oauth/#obtain-a-token)
* Verify the Access Token using [Verify account credentials](https://docs.joinmastodon.org/methods/accounts/)
   * If valid, you'll receive an [Account](https://docs.joinmastodon.org/entities/account/) payload
   * You can now publish statuses on behalf of the logged-in user
   * Note the Account `"url"`
* Fetch the Account url using the ActivityPub Accept header
   * Will return an ActivityPub Person object
   * Note the Person `"outbox"` url
* Post the reply comment to the user's outbox url using the ActivityPub standard [Create Activity API](https://www.w3.org/TR/activitypub/#create-activity-outbox)
   * Pleroma requires a wrapped activity (as shown below), it does not support automatic wrapping
   * Pleroma requires a `"published"` date
   * Use the `"id"` of the comment or subcomment above for `"inReplyTo"`
   * Pleroma will take care of federating the comment to the target Mastodon server
   * Mastodon requires `"conversation"` to be set properly in order to show the federated comment in the reply chain

```
POST https://pleroma-example.com/users/the-user/outbox
Authorization: Bearer <access-token>

{
    "@context": "https://www.w3.org/ns/activitystreams",
    "type": "Create",
    "to": [
        "https://www.w3.org/ns/activitystreams#Public"
        "https://mastodon-example.com/users/a-user"
    ],
    "object": {
        "type": "Note",
        "to": [
        "https://www.w3.org/ns/activitystreams#Public",
        "https://mastodon-example.com/users/a-user"
        ],
        "conversation": "<conversation-from-comment-above>",
        "published": "2021-12-15T18:46:37.830Z",
        "content": "This is the reply comment!",
        "inReplyTo": "<id-from-comment-above>"
    }
}
```