# Post a reply comment as a user on the episode's comment server

In this scenario, the podcast client app facilitates logging in as an authenticated user of the ActivityPub server specified in the RSS feed.

In general, this is possible as long as you can login (via oauth) as a known user (actor) on the ActivityPub instance, and POST to the /outbox of that user (see [Create Activity](https://www.w3.org/TR/activitypub/#create-activity-outbox))

You’ll need to have a few things besides the comment content itself before posting the comment:

1. The id of the comment you are replying to.
   * e.g. Fetch the root comment node as described above in “List public comments for a given episode”, and identify the id. 
   * `"id": "https://podcastindex.social/users/dave/statuses/107185918284627417",`

2. The user actor url you are posting on behalf of (e.g. https://podcastindex.social/@the-user)
   * Obtain this from the service’s login/signup url? TODO

3. The outbox url of the user you are posting on behalf of (included in the standard ActivityPub json response to step 2)
   * `"outbox": "https://podcastindex.social/users/the-user/outbox",`

4. An oauth bearer token for the user you are posting on behalf of, with an appropriate oauth scope to write.
   * For Mastodon, the process for obtaining a token is described [here](https://docs.joinmastodon.org/client/token/)
   * TODO: figure out other popular ActivityPub instance mechanisms.  It looks like Pleroma uses the same API as Mastodon.

  
To create a new reply to a root comment (or subcomment), use the ActivityPub standard [Create Activity API](https://www.w3.org/TR/activitypub/#create-activity-outbox)
```
POST https://podcastindex.social/users/the-user/outbox
Authorization: Bearer <token-obtained-above>

{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Note",
  "content": "This is a reply!",
  "published": "2021-11-10T15:04:55Z",
  "inReplyTo": "https://podcastindex.social/users/dave/statuses/107185918284627417"
}
```