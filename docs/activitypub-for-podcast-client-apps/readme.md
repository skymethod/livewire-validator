# ActivityPub for Podcast Client Apps
_November-December 2021_

These docs represent the subset of the fediverse/ActivityPub information necessary to 
implement the `activitypub` protocol specified in the [comments for podcasting proposal](https://github.com/Podcastindex-org/podcast-namespace/blob/main/proposal-docs/social/social.md) from podcastindex.org.  It's targeted at developers of podcasting apps wanting to integrate these
standardized comments into their own apps.

## State of ActivityPub implementations
In practice, ActivityPub is comprised of two main modes of interaction.  From [the spec](https://www.w3.org/TR/activitypub/):
> * A [server to server federation protocol](https://www.w3.org/TR/activitypub/#server-to-server-interactions) (so decentralized websites can share information)
> * A [client to server protocol](https://www.w3.org/TR/activitypub/#client-to-server-interactions) (so users, including real-world users, bots, and other automated processes, can communicate with ActivityPub using their accounts on servers, from a phone or desktop or web application or whatever)

### c2s
Podcast client apps can use the client-to-server (or _c2s_) ActivityPub interactions to fetch objects (e.g. public comments, user names/avatars) in a server-agnostic way. The c2s interactions are
the easiest to get started with, since the podcast app can interact with existing servers directly,
without needing to stand up another internet-facing service of their own.

However, given the open-ended nature of the ActivityPub, ActivityStream, and related specs, popular fediverse server implementations like Mastodon & Pleroma surface only a subset of their full functionality over c2s ActivityPub, reserving the rest for their proprietary c2s API (such as the [Mastodon REST API](https://docs.joinmastodon.org/api/)).

Reading information via standard ActivityPub is generally available in all servers, but writing back (posting) is constrained (in Pleroma's case) or completely nonexistant (in Mastodon's case).

Authorization is also left out of the ActivityPub spec, so c2s scenarios that require it (like posting) will be server-specific.  Fortunately, Mastodon has a simple oauth process (which Pleroma supports as well) as part of their REST API.

### s2s

Podcast client apps could also choose to use the server-to-server (or _s2s_) ActivityPub interactions to host their
own comments for federation out to server specified by the podcaster in their feed.  This requires
more work, but means a higher fidelity integration with popular fediverse server implementations, since this is the part of ActivityPub they support the most.

This would be the right choice if a podcast client app wanted to use an existing user system without having to deal with users creating new accounts on external servers.

However, it's more complicated, involves hosting UGC on your own server infrastructure, and operating your own 24/7 internet service as another part of your stack.

_TODO: create a minimal proof of concept service that can serve as an ActivityPub-based host simply for commenting on other server's posts._

## Podcast client app scenarios
Walkthroughs of specific examples relevant to podcast apps
* [Display public comments for an episode (c2s)](display-comments.md)
* Post a reply comment...
  * [...as a user of the episode's comment server (c2s)](post-comment.md)
  * [...as a user of another federated ActivityPub server, not the episode's comment server (c2s)](post-comment-federated.md)
  * [...using a custom ActivityPub server that you implement yourself (s2s)](post-comment-custom.md)

## Useful Docs
ActivityPub Spec<br>
https://www.w3.org/TR/activitypub/

Activity Vocabulary Spec<br>
https://www.w3.org/TR/activitystreams-vocabulary

Activity Streams 2.0 Spec (defines Collection, the type of replies)<br>
https://www.w3.org/TR/activitystreams-core/

Mastodon: Obtaining client app access<br>
https://docs.joinmastodon.org/client/token/