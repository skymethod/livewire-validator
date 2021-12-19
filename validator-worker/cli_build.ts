import { basename, dirname, join, fromFileUrl, resolve, ModuleWatcher, Bytes } from './deps_cli.ts';

export async function build(_args: (string | number)[], options: Record<string, unknown>) {
    const thisPath = fromFileUrl(import.meta.url);
    const validatorWorkerPath = dirname(thisPath);
    const validatorAppPath = resolve(validatorWorkerPath, '../validator-app');
    const appPath = join(validatorAppPath, 'validator_app.ts');
    const dataPath = join(validatorWorkerPath, 'validator_data.ts');
    const localDataPath = join(validatorWorkerPath, 'validator_local_data.ts');

    const regenerateAppContents = async () => {
        console.log(`bundling ${basename(appPath)} into bundle.js...`);
        try {
            const start = Date.now();
            const result = await Deno.emit(appPath, { bundle: 'module', compilerOptions: {
                lib: ['esnext', 'dom', 'dom.iterable'],
            } });
            console.log(`bundle finished in ${Date.now() - start}ms`);
        
            if (result.diagnostics.length > 0) {
                console.warn(Deno.formatDiagnostics(result.diagnostics));
                return;
            }
        
            await updateFile(result, dataPath, 'bundle.js', `VALIDATOR_APP`);
            if (options.sourcemaps) await updateFile(result, localDataPath, 'bundle.js.map', `VALIDATOR_APP_MAP`);

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

async function updateFile(result: Deno.EmitResult, dataPath: string, name: string, constantPrefix: string) {
    const contentsStr = result.files[`deno:///${name}`];
    if (typeof contentsStr !== 'string') throw new Error(`${name} not found in bundle output files: ${Object.keys(result.files).join(', ')}`);
   
    const bytes = Bytes.ofUtf8(contentsStr);
    const sha1 = await bytes.sha1();
    await updateData(`${constantPrefix}_B64`, bytes.base64(), dataPath);
    await updateData(`${constantPrefix}_HASH`, sha1.hex(), dataPath);
}

async function updateData(name: string, value: string, dataPath: string) {
    const oldText = await Deno.readTextFile(dataPath);
    const newText = oldText.replaceAll(new RegExp(`export const ${name} = '.*?';`, 'g'), `export const ${name} = '${value}';`);
    if (oldText == newText) return;
    await Deno.writeTextFile(dataPath, newText);
    console.log(`Updated ${name}`);
}
