@AGENTS.md

## Claude Code

- Verify with `npm run build && npm run lint`. There are no tests. If `node_modules/` is missing, ask before running `npm install`.
- `Port5176App.tsx` is about 6.5k lines. Read it in ranges and use Grep to find symbols, don't read the whole file. `seedData.ts` has very long base64 lines, so don't `cat` it.
- Behavior changes are UI-visible, so use the `run` skill (dev server on port 5176) to check them in a browser.
