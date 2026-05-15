# Contributing to Codex Remote

Thanks for taking the time to contribute.

## Before you start

- Read [`README.md`](README.md) for the current product scope.
- Keep the main product direction intact:
  - `Mac = 主控台`
  - `iPhone / iPad = 副控端`
  - `本地优先，局域网可用`

## Development workflow

1. Make focused changes.
2. Prefer improving existing product flows over adding experimental surface area.
3. Run the relevant test suites before opening a PR.

## Test commands

Node tests:

```bash
npm test
```

Swift tests:

```bash
swift test
```

Full local verification:

```bash
npm run test:all
```

## Code guidelines

- Keep naming aligned with the product name `Codex Remote`.
- Avoid adding new user-facing experimental features to the main README unless they are part of the current product path.
- Prefer local-first behavior and clear failure states.
- When updating onboarding or help text, keep wording concise and practical.

## Pull requests

Good PRs usually include:

- a short summary of the user-facing change
- verification notes
- screenshots for visible UI changes
- notes about migration or compatibility if behavior changed

## Security and privacy

- Never commit real tokens, credentials, device names, private keys, or local machine paths that identify a person.
- Use documentation-reserved example addresses such as `192.0.2.x` or `198.51.100.x` in tests and examples.
