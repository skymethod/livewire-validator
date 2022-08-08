# livewire-validator
Experimental podcast feed validator, supporting all of the new [podcast namespace](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md) tags

Public version available at: https://validator.livewire.io/

## Development setup
- Ensure [vscode](https://code.visualstudio.com/) is installed
- Ensure [Deno](https://deno.land/) is installed
- Ensure the [Deno vscode extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno) is installed (from vscode -> Extensions)
- There are two vscode projects:
  - `code validator-app` to work on the client-side javascript app
  - `code validator-worker` to work on the cli, server (Cloudflare Worker), or common validation logic
- Run the standard `deno test` to run unit tests
- Install the `validator` cli tool
  - (from the `validator-worker` dir) `deno install --name validator -Af --unstable cli.ts`
- Run `validator build` to rebuild/embed the client app on any changes
- Run `validator validate <url>` to quickly test validation rules on the command-line
- Use [`denoflare serve`](https://denoflare.dev/cli/serve) to run the server on your local machine
  - Ensure [denoflare](https://denoflare.dev/cli/) is installed
  - Run without config (from the `validator-worker` dir): `denoflare serve validator_worker.ts --watch-include static`
  - Or using a .denoflare config file (example below): `denoflare serve validator-local --watch-include static`
  - See the config below for the optional worker environment variable bindings to configure secrets

## Example .denoflare config
```jsonc
{
	// This file supports comments!
	"$schema": "https://raw.githubusercontent.com/skymethod/denoflare/v0.5.6/common/config.schema.json",

	"scripts": {
        "validator-local": {
			"path": "/path/to/livewire-validator/validator-worker/validator_worker.ts",
		    "bindings": {

                // optional: displayed in the UI as the app version
				"version": { "value": "local" },

                // optional: needed for search
				"piCredentials": { "value": "<api-key>:<api-secret>" },

                // optional: needed for twitter api calls
				"twitterCredentials": { "value": "bearer:<bearer-token>" },

                // optional: needed for mastodon login to reply
				"origin" : { "value": "http://localhost:8820" },
				"mastodonClientName": { "value": "livewire-validator (local dev)" },
				"mastodonClientUrl": { "value": "https://github.com/skymethod/livewire-validator" },
				"storageNamespace": { "doNamespace": "local:StorageDO:storage=webstorage:container=validator-local" },
			},
			"localPort": 8820, // optional: to run on a specific local port (default 8080)
		},
    }
}
```