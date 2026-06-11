# Fitness Dashboard

Static GitHub Pages dashboard for Bernardo's workout metrics.

- Public files contain only encrypted data (`data/fitness.encrypted.json`).
- Browser decrypts locally with WebCrypto.
- Current password: `musculos`.

## Update data

```bash
npm run build:data
```

Then commit/push. The raw JSON is generated locally and ignored by git.
