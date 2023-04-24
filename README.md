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

- `webhooks` is an array of objects with the properties
  - `path` (absolute path of the project folder), and
  - `command` (command which to run in the project folder, e.g. `git pull`).
  - A webhook can also have a separate GitHub `secret` configured to override the global secret.
  - A webhook can also have a `filter` property where the keys are key paths on the `req` object (like `headers.x-github-event` or `body.action`). The values will be compared and only if all filters match, the webook is executed.
  - There are multiple shortcuts for these filters that can be given directly in the webhook object (**not** the filter object):
    - `repository` (will be moved into `filter["body.repository.full_name"]`), e.g. "gbv/cocoda"
    - `event` (will be moved into `filter["headers.x-github-event"]`), e.g. "release"
    - `action` (will be moved into `filter["body.action"]`), e.g. "released"
    - `ref` (will be moved into `filter["body.ref"]`), e.g. "refs/heads/dev"
  - `skipReleaseCheck` (see below)
  - It is also possible to provide environment variables based on the `req` object for the command. These are defined as an object `env` where the keys are key paths on `req` (like in `filter`) and the values are the names of the variable that will be set before exectuing the command.
    - In the example above, the "x-github-event" header will be made available as `$EVENT`.

### Special Case: Release Handling
If `event` is set to "release" and `action` is set to "released" or "published", the release version number is checked against the `package.json` file in `path`, if it exists. If it is a new major release or a downgrade (compared to the local version), the command is **not** executed. This behavior can be overridden by setting `skipReleaseCheck` to `true` on the webhook.

## Webhook setup

It's necessary to select `application/json` content type.
