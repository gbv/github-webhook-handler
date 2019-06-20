const crypto = require("crypto")
const _ = require("lodash")

let config
try {
  config = require("./config.json")
} catch(error) {
  console.error("config.json file is required (see README).")
  process.exit(1)
}
const port = config.port || 2999
config.webhooks = config.webhooks || []
if (config.webhooks.length) {
  console.log(`${config.webhooks.length} webhook(s) configured.`)
} else {
  console.warn("There are no webhooks configured in config.json. Please add at least one webhook.")
}
// Adjust webhooks
const propertyMappings = {
  repository: "body.repository.full_name",
  event: "headers.x-github-event",
  action: "body.action",
  ref: "body.ref",
}
for (let webhook of config.webhooks) {
  if (!webhook.filter) {
    webhook.filter = {}
  }
  _.forEach(propertyMappings, (value, key) => {
    if (webhook[key]) {
      webhook.filter[value] = webhook[key]
    }
  })
}

const exec = require("child_process").exec

const express = require("express")
const bodyParser = require("body-parser")

let app = express()
app.use(bodyParser.json())

app.post("/", (req, res) => {
  // Run command according to payload
  const matches = config.webhooks.filter(
    entry =>
      // Check filter
      _.keys(entry.filter)
        .map(key => _.isEqual(entry.filter[key], _.get(req, key)))
        // All filters have to match
        .reduce((a, b) => a && b, true)
  )
  for (let match of matches) {
    let sig = "sha1=" + crypto.createHmac("sha1", match.secret || config.secret).update(JSON.stringify(req.body)).digest("hex")
    if (req.headers["x-hub-signature"] === sig) {
      let command = ""
      // Add environment variables if needed
      _.forEach(match.env || {}, (env, path) => {
        let value = _.get(req, path)
        if (_.isString(value)) {
          command += `${env}=${value}; `
        }
      })
      command += `cd ${match.path} && ${match.command}`
      console.log(`${new Date()} (${req.body.ref} on ${match.repository}):\n\t${command}`)
      exec(command)
    }
  }
  res.sendStatus(200)
})

app.listen(port, () => console.log(`Listening on port ${port}!`))
