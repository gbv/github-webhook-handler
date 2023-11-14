import crypto from "node:crypto"
import _ from "lodash"

import fs from "node:fs"
import path from "node:path"

let info
try {
  info = JSON.parse(fs.readFileSync("./package.json"))
} catch (error) {
  // ignore
}

let config
try {
  config = JSON.parse(fs.readFileSync("./config.json"))
} catch(error) {
  console.error("config.json file is required (see README).")
  process.exit(1)
}

// Also support secret from enviroment variable
config.secret = config.secret ?? process.env.WEBHOOK_SECRET

// Configure logging
config.verbosity = ["log", "warn", "error", "all", "none"].includes(config.verbosity) ? config.verbosity : "log"
config.log = (options) => {
  let verbosity, message, level
  if (_.isString(options)) {
    message = options
    level = "log"
    verbosity = config.verbosity
  } else {
    verbosity = options.verbosity ?? config.verbosity
    message = options.message
    level = options.level ?? "log"
  }
  verbosity = verbosity ?? config.verbosity
  const log = () => console[level](new Date().toISOString(), message)
  if (verbosity === "none") {
    return
  }
  if (verbosity === "all") {
    if (level === "all") {
      level = "log"
    }
    log()
  } else if (verbosity === "log") {
    if (level !== "all") {
      log()
    }
  } else if (verbosity === "warn") {
    if (level === "warn" || level === "error") {
      log()
    }
  } else if (verbosity === "error" && level === "error") {
    log()
  }
}
config.warn = (message) => config.log({ message, level: "warn" })
config.error = (message) => config.log({ message, level: "error" })

config.log(`Starting GitHub Webhook Handler version ${info?.version} (gbv/github-webhook-handler)...`)

const port = config.port || 2999
config.webhooks = config.webhooks || []
if (config.webhooks.length) {
  config.log(`${config.webhooks.length} webhook(s) configured.`)
} else {
  config.warn("There are no webhooks configured in config.json. Please add at least one webhook.")
}

if (!config.secret) {
  config.warn("No global secret provided. Only webhooks with a local secret or skipValidation are executed.")
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

const adjustMessage = (message) => {
  let newMessage = message
  while (newMessage.endsWith("\n")) {
    newMessage = newMessage.slice(0, -1)
  }
  newMessage = newMessage.replaceAll("\n", "\n\t")
  return newMessage
}

import { exec } from "node:child_process"

import express from "express"
import bodyParser from "body-parser"

let app = express()

// Saves a valid raw JSON body to req.rawBody
// Credits to https://stackoverflow.com/a/35651853/90674
app.use(bodyParser.json({
  verify: (req, res, buf, encoding) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || "utf8")
    }
  },
}))

import Version from "./version.js"

app.post("/", (req, res) => {
  if (!req.rawBody) {
    res.status(400).send("Empty request body")
  }
  let code = 200, message = "OK"
  // Run command according to payload
  const matches = config.webhooks.filter(
    entry =>
      // Check filter
      _.keys(entry.filter)
        .map(key => _.isEqual(entry.filter[key], _.get(req, key)))
        // All filters have to match
        .reduce((a, b) => a && b, true),
  )
  for (let match of matches) {
    const uid = crypto.randomBytes(4).toString("hex")
    const log = (message, { level = "log" } = {}) => {
      config.log({
        message: `${uid} (${req.body.ref || match.path} on ${match.repository}):\n\t${adjustMessage(message)}`,
        level,
        verbosity: match.verbosity,
      })
    }
    const secret = match.secret ?? config.secret
    const sig = secret && "sha1=" + crypto.createHmac("sha1", secret).update(req.rawBody).digest("hex")
    if (sig ? (req.headers["x-hub-signature"] === sig) : match.skipValidation) {
      let command = ""
      // Add environment variables if needed
      _.forEach(match.env || {}, (env, path) => {
        let value = _.get(req, path)
        if (_.isString(value)) {
          command += `${env}='${value}'; `
        }
      })
      // For "release" event with action "published" or "released", compare version numbers if applicable and don't run command if it's a new major release or a downgrade
      if (!match.skipReleaseCheck && match.event === "release" && (match.action === "published" || match.action === "released")) {
        try {
          const packageInfo = JSON.parse(fs.readFileSync(path.resolve(match.path, "package.json")))
          const fromVersion = Version.from(packageInfo.version)
          const toVersion = Version.from(req.body.release.tag_name)
          let reason
          if (
            (toVersion.major > fromVersion.major) ||
            (fromVersion.major === 0 && toVersion.major === 0 && toVersion.minor > fromVersion.minor)
          ) {
            reason = "major update"
          } else if (toVersion.lt(fromVersion)) {
            reason = "downgrade"
          }
          if (reason) {
            log(`Skipping command because release is a ${reason} (${fromVersion.version} -> ${toVersion.version}).\n\tYou can change this behavior by setting \`skipReleaseCheck\` to \`true\` on the webhook.`)
            continue
          }
        } catch (error) {
          // Skip error (non-existent package.json, misformed package.json, etc.)
        }
      }
      command += `cd ${match.path} && ${match.command}`
      log(`Command running: ${command}`)
      exec(command, (error, stdout) => {
        if (error) {
          stdout && log(stdout, { level: "all" })
          error.message && log(error.message, { level: "error" })
        } else {
          stdout && log(stdout, { level: "all" })
          log("Command succeeded.")
        }
      })
    } else {
      log("Skipping workflow as signature does not match", { level: "warn" })
      code = 403
      message = "Request body was not signed or verification failed"
    }
  }
  if (matches.length === 0) {
    config.log({
      message: `Error: Received request that does not match any webhook: ${JSON.stringify(req.body)}`,
      level: "all",
    })
    code = 404
    message = "No matching webhook found"
  }
  res.status(code).send(message)
})

app.listen(port, () => config.log(`Listening on port ${port}!`))
