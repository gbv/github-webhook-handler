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
  "ref": "refs/heads/master",
  "webhooks": [
    {
      "path": "/path/to/project/",
      "repository": "user/projectName",
      "command": "git pull"
    }
  ]
}
```

- `port` is the express port the server will be running on.
- `secret` is the secret configured in the GitHub webook.
- `ref` is the full Git ref that was pushed (optional).

- `webhooks` is an array of objects with the properties
  - `path` (absolute path of the project folder),
  - `repository` (name of the repository on GitHub), and
  - `command` (command which to run in the project folder, e.g. `git pull`).
  - A webhook can also have a separate GitHub `secret` configured to override the global secret.
  - A webhook can also have a separate `ref` property configured to override the global `ref`.
