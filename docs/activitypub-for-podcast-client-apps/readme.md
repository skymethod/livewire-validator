# ActivityPub for Podcast Client Apps
_November-December 2021_

## Useful Docs
ActivityPub Spec<br>
https://www.w3.org/TR/activitypub/

Activity Vocabulary Spec<br>
https://www.w3.org/TR/activitystreams-vocabulary

Activity Streams 2.0 Spec (defines Collection, the type of replies)<br>
https://www.w3.org/TR/activitystreams-core/

Mastodon: Obtaining client app access<br>
https://docs.joinmastodon.org/client/token/

## Podcast client app scenarios

* [Display comments for an episode](display-comments.md)
* Post a reply comment...
  * [...as a user of the episode's comment server](post-comment.md)
  * [...as a user of another federated ActivityPub server (not the episode's comment server)](post-comment-federated.md)
  * [...using a custom ActivityPub server that you implement yourself](post-comment-custom.md)
