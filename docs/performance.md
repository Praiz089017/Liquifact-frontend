# Performance

## Bundle-size budgets

This project uses [size-limit](https://github.com/ai/size-limit) to guard against bundle bloat.

### Budgets

| Route | Budget | File pattern |
|-------|--------|-------------|
| `/` (Home) | 150 kB | `.next/static/chunks/app/page-*.js` |
| `/invest` | 200 kB | `.next/static/chunks/app/invest/page-*.js` |
| `/invoices` | 200 kB | `.next/static/chunks/app/invoices/page-*.js` |

Budgets are defined in `.size-limit.json` at the project root.

### Running locally

```bash
npm run build
npm run size-limit
```

The `build` step is required first because size-limit reads from the `.next` build output.

### CI

The `size.yml` workflow runs on every PR to `main`. It builds the app and checks every budget. If a route exceeds its budget the workflow fails, preventing the PR from merging.

### Updating budgets intentionally

1. Run `npm run build && npm run size-limit` to see current sizes.
2. Edit `.size-limit.json` and adjust the relevant `limit` value.
3. Update the table above in this file if the budget changed.
4. Run `npm run build && npm run size-limit` again to confirm the new budget passes.

Budget increases should be rare and justified (e.g. a deliberate new feature that adds first-load JS). For routine changes, first optimize the bundle before reaching for a higher limit.

### How it works

- The `@size-limit/file` plugin measures the gzip size of the file globs.
- Budgets target the route-specific JS chunks produced by the Next.js App Router build.
- The check runs after `next build` so it measures the real production output.
