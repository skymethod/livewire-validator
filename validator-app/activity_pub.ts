/** Describes an object of any kind. 
 * 
 * The Object type serves as the base type for most of the other kinds of objects defined in the Activity Vocabulary, including other Core types such as Activity, IntransitiveActivity, Collection and OrderedCollection.  
 * 
 * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-object
 */
export interface Object_ {

    readonly type: string;

    /** Global identifier */
    readonly id: string;

    /**
     * Identifies one or more entities to which this object is attributed.
     * 
     * The attributed entities might not be Actors. For instance, an object might be attributed to the completion of another activity.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-attributedto
     */
    readonly attributedTo: string | Link;

    /**
     * The content or textual representation of the Object encoded as a JSON string.
     * 
     * By default, the value of content is HTML. The mediaType property can be used in the object to indicate a different content type.
     * 
     * The content MAY be expressed using multiple language-tagged values.
     *
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-content
     */
    readonly content?: string;

    /**
     * The content or textual representation of the Object encoded as a JSON string.
     * 
     * By default, the value of content is HTML. The mediaType property can be used in the object to indicate a different content type.
     * 
     * The content MAY be expressed using multiple language-tagged values.
     *
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-content
     */
    readonly contentMap?: Record<string, string>;

    /**
     * Identifies the MIME media type of the value of the content property. If not specified, the content property is assumed to contain text/html content.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-mediatype
     */
    readonly mediaType?: string;

    /**
     * Identifies a Collection containing objects considered to be responses to this object.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-replies
     */
    readonly replies?: string | Collection;

    /**
     * A simple, human-readable, plain-text name for the object.
     * 
     * HTML markup MUST NOT be included. The name MAY be expressed using multiple language-tagged values.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-name
     */
    readonly name?: string;

    /**
     * A simple, human-readable, plain-text name for the object.
     * 
     * HTML markup MUST NOT be included. The name MAY be expressed using multiple language-tagged values.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-name
     */
    readonly nameMap?: Record<string, string>;

    /**
     * Identifies one or more links to representations of the object.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-url
     */
    readonly url?: string | Link | readonly (string | Link)[];

    /**
     * Indicates an entity that describes an icon for this object.
     * 
     * The image should have an aspect ratio of one (horizontal) to one (vertical) and should be suitable for presentation at a small size.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-icon
     */
    readonly icon?: Image | string | Link | readonly (Image | string | Link)[];

    /**
     * The date and time at which the object was published.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-published
     */
    readonly published?: string;

    /**
     * Identifies a resource attached or related to an object that potentially requires special handling.
     * 
     * The intent is to provide a model that is at least semantically similar to attachments in email.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-attachment
     */
    readonly attachment?: Object_ | string | Link | readonly (Object_ | string | Link)[];

    /** found on Document objects representing image attachments */
    readonly width?: number;

    /** found on Document objects representing image attachments */
    readonly height?: number;
}

/**
 * Represents a short written work typically less than a single paragraph in length.
 * 
 * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-note
 */
export interface Note extends Object_ {
    readonly type: 'Note';
}

/**
 * A Link is an indirect, qualified reference to a resource identified by a URL. 
 * 
 * The fundamental model for links is established by [ RFC5988]. 
 * Many of the properties defined by the Activity Vocabulary allow values that are either instances of Object or Link. 
 * When a Link is used, it establishes a qualified relation connecting the subject (the containing object) to the resource identified by the href. 
 * Properties of the Link are properties of the reference as opposed to properties of the resource.
 * 
 * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-link
 */
export interface Link {

    readonly type: 'Link';

    /**
     * The target resource pointed to by a Link.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-href
     */
    readonly href: string;

    /**
     * A link relation associated with a Link. The value MUST conform to both the [HTML5] and [RFC5988] "link relation" definitions.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-rel
     */
    readonly rel?: string;

    /**
     * Identifies the MIME media type of the referenced resource.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-mediatype
     */
    readonly mediaType?: string;

    /**
     * A simple, human-readable, plain-text name for the object. HTML markup MUST NOT be included.
     * 
     * The name MAY be expressed using multiple language-tagged values.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-name
     */
    readonly name?: string;

    /**
     * A simple, human-readable, plain-text name for the object. HTML markup MUST NOT be included.
     * 
     * The name MAY be expressed using multiple language-tagged values.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-name
     */
    readonly nameMap?: Record<string, string>;

    /**
     * Hints as to the language used by the target resource. Value MUST be a [BCP47] Language-Tag.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-hreflang
     */
    readonly hreflang: string;

    /**
     * Specifies a hint as to the rendering height in device-independent pixels of the linked resource.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-height
     */
    readonly height: number;

    /**
     * Specifies a hint as to the rendering width in device-independent pixels of the linked resource.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-width
     */
    readonly width: number;

    /**
     * Identifies an entity that provides a preview of this object.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-preview
     */
    readonly preview?: string | Link | Object_;
}

/**
 * Collection objects are a specialization of the base Object that serve as a container for other Objects or Links.
 * 
 * https://www.w3.org/TR/activitystreams-core/#collection
 */
interface CollectionBase extends Object_ {
    /**
     * Identifies the items contained in a collection. The items might be ordered or unordered.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-items
     */
     readonly items?: readonly (string | Link | Object_)[];

     /**
      * A non-negative integer specifying the total number of objects contained by the logical view of the collection.
      * 
      * This number might not reflect the actual number of items serialized within the Collection object instance.
      * 
      * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-totalitems
      */
     readonly totalItems?: number;
 
     /**
      * In a paged Collection, indicates the furthest preceeding page of items in the collection.
      * 
      * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-first
      */
     readonly first?: string | Link | CollectionPage;
 
     /**
      * In a paged Collection, indicates the furthest proceeding page of the collection.
      * 
      * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-last
      */
     readonly last?: string | Link | CollectionPage;
 
     /**
      * In a paged Collection, indicates the page that contains the most recently updated member items.
      * 
      * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-current
      */
     readonly current?: string | Link | CollectionPage;
}

export interface Collection extends CollectionBase {
    readonly type: 'Collection';
}

/**
 * https://www.w3.org/TR/activitystreams-core/#dfn-orderedcollection
 */
interface OrderedCollectionProperties {
    /** Ordered items are represented using the orderedItems property. */
    readonly orderedItems?: readonly (string | Link | Object_)[];
}

export interface OrderedCollection extends CollectionBase, OrderedCollectionProperties {
    readonly type: 'OrderedCollection';

}

/**
 * A Collection can contain a large number of items. 
 * 
 * Often, it becomes impractical for an implementation to serialize every item contained by a Collection using the items (or orderedItems) property alone. 
 * In such cases, the items within a Collection can be divided into distinct subsets or "pages". 
 * A page is identified using the CollectionPage type.
 * 
 * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-collectionpage
 * https://www.w3.org/TR/activitystreams-core/#dfn-collectionpage
 */
interface CollectionPageProperties {
    /** 
     * Identifies the Collection to which a CollectionPage objects items belong.
     * 
     * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-partof
     */
     readonly partOf?: string | Link | Collection;

     /**
      * In a paged Collection, indicates the next page of items.
      * 
      * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-next
      */
     readonly next?: string | Link | CollectionPage;
 
     /**
      * In a paged Collection, identifies the previous page of items. 
      * 
      * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-prev
      */
     readonly prev?: string | Link | CollectionPage;
}

export interface CollectionPage extends CollectionBase, CollectionPageProperties {
    readonly type: 'CollectionPage';
}

/**
 * The OrderedCollectionPage type extends from both CollectionPage and OrderedCollection
 * 
 * https://www.w3.org/TR/activitystreams-core/#dfn-orderedcollectionpage
 */
export interface OrderedCollectionPage extends CollectionBase, CollectionPageProperties, OrderedCollectionProperties {
    readonly type: 'OrderedCollectionPage';
}

/**
 * ActivityPub actors are generally one of the ActivityStreams Actor Types, but they don't have to be.
 * 
 * For example, a Profile object might be used as an actor, or a type from an ActivityStreams extension. 
 * Actors are retrieved like any other Object in ActivityPub. Like other ActivityStreams objects, actors have an id, which is a URI. 
 * 
 * https://www.w3.org/TR/activitypub/#actor-objects
 */
export interface Actor extends Object_ {

    /**
     * A short username which may be used to refer to the actor, with no uniqueness guarantees.
     * 
     * https://www.w3.org/TR/activitypub/#preferredUsername
     */
    readonly preferredUsername?: string;

}

/**
 * Represents an individual person.
 *
 * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-person
 */
export interface Person extends Actor {
    readonly type: 'Person';
}

/**
 * An image document of any kind 
 * 
 * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-image
 */
export interface Image extends Object_ {
    readonly type: 'Image';
}

/**
 * Represents an audio document of any kind.
 * 
 * https://www.w3.org/TR/activitystreams-vocabulary/#dfn-audio
 */
 export interface Audio extends Object_ {
    readonly type: 'Audio';
}

/**
 * Castopod proposal?
 * https://code.podlibre.org/podlibre/castopod-host/-/merge_requests/146
 */
export interface PodcastEpisode extends Object_ {

    readonly type: 'PodcastEpisode';
    // attributedTo
    // published
    // to
    // cc
    
    readonly comments?: string; // url to ap collection
    readonly description?: Note; // mediaType, content, contentMap
    readonly image?: Image; // mediaType, url
    readonly audio?: Audio; // name, size, duration, url (Link href, mediaType), transcript, chapters
}
