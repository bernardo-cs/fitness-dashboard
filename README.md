# Fitness Dashboard

Static GitHub Pages dashboard for Bernardo's CrossFit data — Notion-style UI with Today / Overview / Strength / Body & Recovery views, lift drawers with progression charts and % loading tables, and three themes.

- Public files contain only encrypted data (`data/fitness.encrypted.json`).
- The browser decrypts locally with WebCrypto (PBKDF2-SHA256 → AES-256-GCM); the passphrase never leaves the browser.
- No build step, no dependencies: plain HTML + ES modules (`index.html`, `app/`).

## Update data

```bash
npm run build:data
```

Reads the source `fitness/*.json` (git-ignored locally; canonical copy lives on the home server at `/root/clawd/fitness` — override with `FITNESS_DIR`), merges them into one payload and encrypts it. Set `FITNESS_PASS` to use a non-default passphrase. Then commit/push `data/fitness.encrypted.json` only.

The full data contract — file schemas, how each field drives the UI, verification steps — is documented in the agent skill at `.claude/skills/dashboard-data/SKILL.md`.

## Local preview

```bash
npm run serve   # http://localhost:8080
```
