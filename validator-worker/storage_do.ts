import { ColoFromTrace, DurableObjectState } from './deps_worker.ts';

export class StorageDO {

    private readonly state: DurableObjectState;
    
    private colo!: string;

    constructor(state: DurableObjectState) {
        this.state = state;
        
        this.state.blockConcurrencyWhile(async () => {
            this.colo = await new ColoFromTrace().get();
        });
    }

    async fetch(request: Request): Promise<Response> {
        console.log(request.url);
        const { colo } = this;
        const durableObjectName = request.headers.get('do-name');
        console.log('logprops:', { colo, durableObjectClass: 'StorageDO', durableObjectId: this.state.id.toString(), durableObjectName });
       
        const url = new URL(request.url);
        const { pathname } = url;
        const key = url.searchParams.get('key');
        const value = url.searchParams.get('value');
        if (pathname === '/get' && key) {
            const val = await this.state.storage.get(key);
            return typeof val === 'string' ? new Response(val) : new Response('Not found', { status: 404 });
        }
        if (pathname === '/set' && key && value) {
            await this.state.storage.put(key, value);
            return new Response('ok');
        }

        return new Response('Not found', { status: 404 });
    }
    
}
