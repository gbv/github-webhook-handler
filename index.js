import crypto from "node:crypto"
import _ from "lodash"

import fs from "node:fs"
import path from "node:path"

let config
try {
  config = JSON.parse(fs.readFileSync("./config.json"))
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

import { exec } from "node:child_process"

import express from "express"
import bodyParser from "body-parser"

let app = express()
app.use(bodyParser.json())

import Version from "./version.js"

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
    const log = (message) => {
      console.log(`${new Date().toISOString()} (${req.body.ref || match.path} on ${match.repository}):\n\t${message}`)
    }
    let sig = "sha1=" + crypto.createHmac("sha1", match.secret || config.secret).update(JSON.stringify(req.body)).digest("hex")
    if (req.headers["x-hub-signature"] === sig) {
      let command = ""
      // Add environment variables if needed
      _.forEach(match.env || {}, (env, path) => {
        let value = _.get(req, path)
        if (_.isString(value)) {
          command += `${env}='${value}'; `
        }
      })
      // For "release" event with action "published", compare version numbers if applicable and don't run command if it's a new major release
      if (!match.skipReleaseCheck && match.event === "release" && match.action === "published") {
        try {
          const packageInfo = JSON.parse(fs.readFileSync(path.resolve(match.path, "package.json")))
          const fromVersion = Version.from(packageInfo.version)
          const toVersion = Version.from(req.body.release.tag_name)
          if (toVersion.major > fromVersion.major) {
            log(`Skipping command because release is a major update (${fromVersion.version} -> ${toVersion.version}).\n\tYou can change this behavior by setting \`skipReleaseCheck\` to \`true\` on the webhook.`)
            continue
          }
        } catch (error) {
          // Skip error (non-existent package.json, misformed package.json, etc.)
        }
      }
      command += `cd ${match.path} && ${match.command}`
      log(`${command}`)
      exec(command)
    }
  }
  res.sendStatus(200)
})

app.listen(port, () => console.log(`Listening on port ${port}!`))
