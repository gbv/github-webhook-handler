# GitHub Webhook Handler

A small express server to run commands for GitHub webhooks.

## Installation

```bash
git clone
cd github-webhook-handler
npm install
echo "{}" > config.json
npm run start
```

### Run with Deno
Deno should be able to run this without modification:

```sh
deno run --allow-env --allow-read --allow-net --allow-run index.js
```

## Configuration

A `config.json` file is necessary. It should look like this:

```json
{
  "port": 2999,
  "secret": "your_secret",
  "webhooks": [
    {
      "path": "/path/to/project/",
      "repository": "user/projectName",
      "ref": "refs/heads/master",
      "command": "git pull; echo $EVENT",
      "env": {
        "headers.x-github-event": "EVENT"
      }
    }
  ]
}
```

- `port` is the express port the server will be running on.
- `secret` is the secret configured in the GitHub webook.
  - The secret can also be provided via the environment variable `WEBHOOK_SECRET`.
- `verbosity` allows controlling which output is logged.
  - `log` adds default logging (which webhooks are executed, etc.) as well as error logging for executed commands (default)
  - `verbose` is the same as `log`, but also logs standout output of executed commands
  - `all` is the same as `verbose`, but also logs the full body of unmatched requests
  - `warn` skip all logging, except warnings and error logging for executed commands
  - `error` skip all logging, except error logging for executed commands
  - `none` disables all logging

- `webhooks` is an array of objects with the properties
  - `path` (absolute path of the project folder; will be the user's home folder by default)
  - `command` (command which to run in the project folder, e.g. `git pull`)
  - A webhook can also have a separate GitHub `secret` configured to override the global secret.
  - A webhook can also have a separate GitHub `verbosity` configured to override the global verbosity.
  - A webhook can also have a `filter` property where the keys are key paths on the `req` object (like `headers.x-github-event` or `body.action`). The values will be compared and only if all filters match, the webook is executed.
  - There are multiple shortcuts for these filters that can be given directly in the webhook object (**not** the filter object):
    - `repository` (will be moved into `filter["body.repository.full_name"]`), e.g. "gbv/cocoda"
    - `event` (will be moved into `filter["headers.x-github-event"]`), e.g. "release"
    - `action` (will be moved into `filter["body.action"]`), e.g. "released"
    - `ref` (will be moved into `filter["body.ref"]`), e.g. "refs/heads/dev"
  - `skipReleaseCheck` (see below)
  - `skipValidation` (allows skipping validation if no secret is given)
  - It is also possible to provide environment variables based on the `req` object for the command. These are defined as an object `env` where the keys are key paths on `req` (like in `filter`) and the values are the names of the variable that will be set before exectuing the command.
    - In the example above, the "x-github-event" header will be made available as `$EVENT`.

### Special Case: Release Handling
If `event` is set to "release" and `action` is set to "released" or "published", the release version number is checked against the `package.json` file in `path`, if it exists. If it is a new major release or a downgrade (compared to the local version), the command is **not** executed. This behavior can be overridden by setting `skipReleaseCheck` to `true` on the webhook.

### Webhooks Without Signature Validation
It is possible to configure webhooks without signature validation. **Experimental feature! Please use with caution!** To use this, do not configure a secret (or if a global secret is configured, set the webhook's secret to an empty string) and set `skipValidation` to `true`.

### Status Codes
- Status 200 (OK) will be returned when a matching webhook was found (the command itself is run asynchronously, so a failed command will not return an error code).
- Status 400 (Bad Request) will be returned when there is an issue parsing the request body.
- Status 403 (Forbidden) will be returned when there was a matching webhook, but the signature could not be validated.
- Status 404 (Not Found) will be returned when no matching webhook was found.

## Webhook setup

It's necessary to select `application/json` content type.
