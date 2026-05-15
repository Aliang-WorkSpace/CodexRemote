# Privacy

Codex Remote is designed to be local-first.

## What the project does

- Reads local Codex state on the Mac host
- Exposes a local control surface for the companion iPhone / iPad app
- Allows viewing session status and sending control commands to the local host

## What the project does not do by default

- It does not require a cloud account for the main local workflow
- It does not upload local Codex state to a public service by default
- It does not depend on a hosted relay as the primary connection path

## Local data

Depending on your setup, the project may read:

- local Codex state and metadata
- local command history and session snapshots
- user-selected workspace context

This data is used to power the local Mac console and the companion mobile experience.

## Network behavior

In the default setup, Codex Remote is intended to run on a local or private network that you control.

If you enable optional sync or future relay-style features, review those settings carefully before using them with sensitive data.

## Credentials and secrets

- Do not commit credentials or private keys into this repository.
- Pairing tokens and local access tokens should be treated as sensitive.
- Rotate local pairing credentials if you suspect they were exposed.

## For app distribution

If you distribute a packaged version of Codex Remote, provide an app-specific privacy policy that matches the actual shipping behavior of that build, including any analytics, crash reporting, or hosted services you enable.
