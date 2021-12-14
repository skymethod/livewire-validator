export interface Comment {
    readonly url?: string;
    readonly attributedTo?: string;
    readonly content: string;
    readonly published?: string;
    readonly replies: Comment[];
    readonly attachments: Attachment[];
}

export interface Commenter {
    readonly icon?: Icon; // new users don't have icons
    readonly name: string;
    readonly url: string;
    readonly fqUsername: string; // e.g. @user@example.com
}

export interface Icon {
    readonly url: string;
    readonly mediaType?: string;
}

export interface Attachment {
    readonly mediaType: string;
    readonly width?: number;
    readonly height?: number;
    readonly url: string;
}
