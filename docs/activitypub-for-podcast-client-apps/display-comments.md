# Display public comments for a given episode

_A client-to-server (or c2s) ActivityPub interaction_

Read the feed: http://mp3s.nashownotes.com/pc20rss.xml

Find the item’s `podcast:socialInteract` tag and discover the ActivityStream object URL:
```
<item>
  <title>Episode 60: Crossing the Line</title>
  ...
  <podcast:socialInteract platform="activitypub" podcastAccountId="@dave" podcastAccountUrl="https://podcastindex.social/@dave">
    https://podcastindex.social/@dave/107185918284627417 👈
  </podcast:socialInteract>
</item>
```
Fetch the discovered ActivityStream object URL with an http accept header of `application/activity+json` to get the root comment node:

```sh
curl -s -H "Accept: application/activity+json" https://podcastindex.social/@dave/107185918284627417 | jq
```

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    {
      "ostatus": "http://ostatus.org#",
      "atomUri": "ostatus:atomUri",
      "inReplyToAtomUri": "ostatus:inReplyToAtomUri",
      "conversation": "ostatus:conversation",
      "sensitive": "as:sensitive",
      "toot": "http://joinmastodon.org/ns#",
      "votersCount": "toot:votersCount",
      "blurhash": "toot:blurhash",
      "focalPoint": {
        "@container": "@list",
        "@id": "toot:focalPoint"
      }
    }
  ],
  "id": "https://podcastindex.social/users/dave/statuses/107185918284627417",
  "type": "Note",
  "summary": null,
  "inReplyTo": null,
  "published": "2021-10-29T17:08:37Z",
  "url": "https://podcastindex.social/@dave/107185918284627417",
  "attributedTo": "https://podcastindex.social/users/dave",
  "to": [
    "https://www.w3.org/ns/activitystreams#Public"
  ],
  "cc": [
    "https://podcastindex.social/users/dave/followers"
  ],
  "sensitive": false,
  "atomUri": "https://podcastindex.social/users/dave/statuses/107185918284627417",
  "inReplyToAtomUri": null,
  "conversation": "tag:podcastindex.social,2021-10-29:objectId=988501:objectType=Conversation",
  "content": "<p>Show time: episode 60! 🍻🎙🎉🍿</p>",
  "contentMap": {
    "en": "<p>Show time: episode 60! 🍻🎙🎉🍿</p>"
  },
  "attachment": [
    {
      "type": "Document",
      "mediaType": "image/jpeg",
      "url": "https://cdn.masto.host/podcastindexsocial/media_attachments/files/107/185/918/185/174/529/original/eb8ebb63b82ad484.jpeg",
      "name": "",
      "blurhash": "UEAJl_9]MISiAH$$Iqsm8wNy.8RjMyWo-oWq",
      "width": 1024,
      "height": 768
    }
  ],
  "tag": [],
  "replies": {
    "id": "https://podcastindex.social/users/dave/statuses/107185918284627417/replies",
    "type": "Collection",
    "first": {
      "type": "CollectionPage",
      "next": "https://podcastindex.social/users/dave/statuses/107185918284627417/replies?only_other_accounts=true&page=true", 👈
      "partOf": "https://podcastindex.social/users/dave/statuses/107185918284627417/replies",
      "items": []
    }
  }
}
```
This is an object of type [Note](https://www.w3.org/TR/activitystreams-vocabulary/#dfn-note) from the Activity Vocabulary spec, representing a comment node.
In general, use a comment node to render a single comment (using `published`, `content/contentMap`, `attributedTo`, `attachment`, etc), and use `replies>first>next` to start iterating each comment’s replies:

```sh
curl -s -H "Accept: application/activity+json" "https://podcastindex.social/users/dave/statuses/107185918284627417
/replies?only_other_accounts=true&page=true" | jq
```
```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    {
      "ostatus": "http://ostatus.org#",
      "atomUri": "ostatus:atomUri",
      "inReplyToAtomUri": "ostatus:inReplyToAtomUri",
      "conversation": "ostatus:conversation",
      "sensitive": "as:sensitive",
      "toot": "http://joinmastodon.org/ns#",
      "votersCount": "toot:votersCount"
    }
  ],
  "id": "https://podcastindex.social/users/dave/statuses/107185918284627417/replies?only_other_accounts=true&page=true",
  "type": "CollectionPage",
  "next": "https://podcastindex.social/users/dave/statuses/107185918284627417/replies?min_id=107186735221324449&only_other_accounts=true&page=true", 👈
  "partOf": "https://podcastindex.social/users/dave/statuses/107185918284627417/replies",
  "items": [
    {
      "id": "https://podcastindex.social/users/mikeneumann/statuses/107186207641991543",
      "type": "Note",
      "summary": null,
      "inReplyTo": "https://podcastindex.social/users/dave/statuses/107185918284627417",
      "published": "2021-10-29T18:22:12Z",
      "url": "https://podcastindex.social/@mikeneumann/107186207641991543",
      "attributedTo": "https://podcastindex.social/users/mikeneumann",
      "to": [
            "https://www.w3.org/ns/activitystreams#Public"
      ],
      "cc": [
        "https://podcastindex.social/users/mikeneumann/followers",
        "https://podcastindex.social/users/dave"
      ],
      "sensitive": false,
      "atomUri": "https://podcastindex.social/users/mikeneumann/statuses/107186207641991543",
      "inReplyToAtomUri": "https://podcastindex.social/users/dave/statuses/107185918284627417",
      "conversation": "tag:podcastindex.social,2021-10-29:objectId=988501:objectType=Conversation",
      "content": "<p><span class=\"h-card\"><a href=\"https://podcastindex.social/@dave\" class=\"u-url mention\">@<span>dave</span></a></span> </p><p>This is like the weekly Bat Signal. </p><p>Looking forward to downloading it later, and someday (soon?) tuning in LIVE. </p><p>TYFYC!</p>",
      "contentMap": {
            "en": "<p><span class=\"h-card\"><a href=\"https://podcastindex.social/@dave\" class=\"u-url mention\">@<span>dave</span></a></span> </p><p>This is like the weekly Bat Signal. </p><p>Looking forward to downloading it later, and someday (soon?) tuning in LIVE. </p><p>TYFYC!</p>"
      },
      "attachment": [],
      "tag": [
        {
          "type": "Mention",
          "href": "https://podcastindex.social/users/dave",
          "name": "@dave"
        }
      ],
      "replies": {
        "id": "https://podcastindex.social/users/mikeneumann/statuses/107186207641991543/replies",
        "type": "Collection",
        "first": {
          "type": "CollectionPage",
          "next": "https://podcastindex.social/users/mikeneumann/statuses/107186207641991543/replies?only_other_accounts=true&page=true", 👈
          "partOf": "https://podcastindex.social/users/mikeneumann/statuses/107186207641991543/replies",
          "items": []
        }
      }
   },...
```

Each reply contained in items is also of type `Note`.  Continue paging through top-level replies using `next`, and grab subreplies using each reply item’s `replies>first>next` url. Using this method, you can render an entire comment thread.