# Trae Preflight

This folder is prepared for `wangxt-1109-1`.

Use `.env` for stable local ports and compose project identity:

- APP_PORT: 18409
- API_PORT: 19409
- WEB_PORT: 20409
- DB_PORT: 21409
- REDIS_PORT: 22409

Smoke entry:

```bash
bash scripts/smoke.sh
```

The preflight files are environment scaffolding only. The generated business
project can replace or extend them when needed.
