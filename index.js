
const crypto = require("crypto")
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
const exec = require("child_process").exec

const express = require("express")
const bodyParser = require("body-parser")

let app = express()
app.use(bodyParser.json())

app.post("/", (req, res) => {
  // Run command according to payload
  const matches = config.webhooks.filter(
    entry =>
      // Check repository name
      entry.repository == req.body.repository.full_name &&
      (
        // Check ref
        (!config.ref && !entry.ref) ||
        (!entry.ref && config.ref == req.body.ref) ||
        (entry.ref && entry.ref == req.body.ref)
      )
  )
  for (let match of matches) {
    let sig = "sha1=" + crypto.createHmac("sha1", match.secret || config.secret).update(JSON.stringify(req.body)).digest("hex")
    if (req.headers["x-hub-signature"] === sig) {
      let command = `cd ${match.path} && ${match.command}`
      console.log(`${new Date()} (${req.body.ref} on ${match.repository}):\n\t${command}`)
      exec(command)
    }
  }
  res.sendStatus(200)
})

app.listen(port, () => console.log(`Listening on port ${port}!`))
