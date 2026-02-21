# Contributing

## Setup

```bash
npm install
npm start
```

## Branching

- Branch from `main`
- Keep changes focused and small
- Use descriptive commit messages

## Pull Requests

- Explain what changed and why
- Include test/build results
- Add screenshots for UI changes when relevant

## Local Checks

- JavaScript syntax checks:

```bash
node --check src/main.js
node --check src/preload.js
node --check src/renderer.js
```

- Build checks:

```bash
npm run pack
# if TLS/proxy blocks downloads:
npm run pack:offline
```

## Security Notes

- Do not commit secrets
- Do not store `GITHUB_TOKEN` in source files
- Keep dangerous command confirmations enabled
