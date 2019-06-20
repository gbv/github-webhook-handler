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
      "command": "git pull"
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
  - There are multiple shortcuts for these filters that can be given directly in the webhook object (**not** the filters object):
    - `repository` (will be moved into `filters["body.repository.full_name"]`), e.g. "gbv/cocoda"
    - `event` (will be moved into `filters["headers.x-github-event"]`), e.g. "release"
    - `action` (will be moved into `filters["body.action"]`), e.g. "published"
    - `ref` (will be moved into `filters["body.ref"]`), e.g. "refs/heads/dev"
