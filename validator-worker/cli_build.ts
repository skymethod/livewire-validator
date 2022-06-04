import { basename, dirname, join, fromFileUrl, resolve, ModuleWatcher, Bytes, bundle, fileExists } from './deps_cli.ts';

export async function build(_args: (string | number)[], options: Record<string, unknown>) {
    const thisPath = fromFileUrl(import.meta.url);
    const validatorWorkerPath = dirname(thisPath);
    const validatorAppPath = resolve(validatorWorkerPath, '../validator-app');
    const appPath = join(validatorAppPath, 'validator_app.ts');
    const staticPath = join(validatorWorkerPath, 'static');
    const appJsPath = join(staticPath, 'app.js');
    const appJsSha1Path = join(staticPath, 'app.js.sha1');
    const appJsMapPath = join(staticPath, 'app.js.map');
    const appJsMapSha1Path = join(staticPath, 'app.js.map.sha1');

    const createSourceMap = !!options.sourcemap;

    const regenerateAppContents = async () => {
        console.log(`bundling ${basename(appPath)} into bundle.js...`);
        try {
            const start = Date.now();
            const { code, sourceMap, backend } = await bundle(appPath, { createSourceMap, compilerOptions: {
                lib: ['esnext', 'dom', 'dom.iterable'],
            }});
            console.log(`bundle (using ${backend}) finished in ${Date.now() - start}ms`);
        
            await updateTextFileIfNecessary(appJsPath, code);
            const sha1Hex = (await Bytes.ofUtf8(code).sha1()).hex();
            await updateTextFileIfNecessary(appJsSha1Path, sha1Hex);

            const sourceMapContents = (createSourceMap ? sourceMap : undefined) ?? '';
            await updateTextFileIfNecessary(appJsMapPath, sourceMapContents);
            const sha1Hex2 = (await Bytes.ofUtf8(sourceMapContents).sha1()).hex();
            await updateTextFileIfNecessary(appJsMapSha1Path, sha1Hex2);

        } catch (e) {
            console.warn('error in regenerateAppContents', e.stack || e);
        }   
    }

    await regenerateAppContents();
    const _moduleWatcher = new ModuleWatcher(appPath, regenerateAppContents);

    return new Promise((_resolve, _reject) => {

    });
}

//

async function updateTextFileIfNecessary(path: string, text: string) {
    const oldText = await fileExists(path) ? await Deno.readTextFile(path) : '';
    if (oldText !== text) {
        await Deno.writeTextFile(path, text);
        console.log(`Updated ${path}`);
    }
}
