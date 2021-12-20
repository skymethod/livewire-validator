import { ValidationJobVM, ValidationJobVMOpts, Message, ExtendedXmlNode, FetchCommentsResult, PIFeedInfo, ValidationOptions  } from './deps_app.ts';

export class ValidatorAppVM {

    private readonly job: ValidationJobVM;
    
    //

    get validating(): boolean { return this.job.validating; }

    get messages(): readonly Message[] { return this.job.messages; }

    get isSearch(): boolean { return this.job.isSearch; }

    get searchResults(): readonly PIFeedInfo[] { return this.job.searchResults; }

    get xml(): ExtendedXmlNode | undefined { return this.job.xml; }

    get xmlSummaryText(): string | undefined { return this.job.xmlSummaryText; }

    get fetchCommentsResult(): FetchCommentsResult | undefined { return this.job.fetchCommentsResult; }

    constructor(opts: ValidationJobVMOpts) {
        this.job = new ValidationJobVM(opts);
        this.job.onChange = () => this.onChange();
    }

    onChange: () => void = () => {};

    start() {
        // load initial state, etc. noop for now
    }

    continueWith(url: string) {
        this.job.continueWith(url);
    }

    startValidation(input: string, options: ValidationOptions) {
        this.job.startValidation(input, options);
    }

    cancelValidation() {
        this.job.cancelValidation();
    }

}
