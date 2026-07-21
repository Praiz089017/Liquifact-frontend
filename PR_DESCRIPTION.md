# feat: add "Upload another invoice" reset flow to UploadZone

Closes #396

---

## Summary

Adds an explicit reset flow to UploadZone that allows users to upload a new invoice after a successful submission without reloading the page. After a successful upload, an **"Upload another invoice"** button appears in the success state that resets the component back to its idle state, clears the file input, and moves focus to the dropzone so keyboard users can immediately start again.

---

## Motivation

After a successful submission, `components/UploadZone.jsx` stayed in the success status with the previous file still selected, and the submit button remained labelled "Upload & Tokenize Invoice" while still pointing at the already-submitted file. There was no clean way to start a fresh upload without reloading the page. This was reported in issue #396.

---

## Changes

### `app/copy/en.js`

- Added `uploadZone.resetAction` (`"Upload another invoice"`) — the button label text.
- Added `uploadZone.resetAriaLabel` — a descriptive `aria-label` for the reset button that communicates its purpose to assistive technologies.
- Updated the `@typedef` JSDoc block with the two new keys.

### `components/UploadZone.jsx`

- **`dropzoneRef`**: Added a `useRef` ref attached to the dropzone `<div>` for programmatic focus management.
- **`resetUpload()` function**: A new function that:
  - Clears `file`, `error`, and `status` back to their initial values (`null`, `null`, `"idle"`).
  - Clears the hidden file `<input>` element's value so the same file can be re-selected if desired.
  - Calls `dropzoneRef.current?.focus()` to move keyboard focus to the dropzone after reset.
- **Success state wrapper**: The success `<p>` (with `role="status"` / `aria-live="polite"`) is now wrapped in a `<div>` alongside the reset `<button type="button">`. This keeps the existing status copy and live region intact while adding the reset action.
- **Reset button**: Styled with `bg-emerald-600` / `hover:bg-emerald-500` to visually distinguish it from the main submit button. Uses the shared `.focus-ring` class and includes a descriptive `aria-label`.
- **Comments**: Added JSDoc and inline comments explaining the focus-management choice per the contributor guidelines.

### `components/UploadZone.test.jsx`

Added **GROUP 4: Reset / Upload another invoice flow** with 5 tests:

| Test | What it verifies |
|------|------------------|
| `shows 'Upload another invoice' button in success state` | The reset button is rendered after a successful upload |
| `clears file, error, and status back to idle after reset` | Success status disappears, file name is gone, submit button is disabled, idle prompt reappears |
| `reset clears stale error` | After reset, no error is present, and selecting an invalid file still triggers a validation error |
| `re-upload after reset works correctly` | Full end-to-end cycle: upload → reset → select new file → upload again → success; verifies `fetch` is called twice |
| `focuses the dropzone after reset` | `document.activeElement` points to the dropzone after clicking the reset button |

All 45 existing tests continue to pass unchanged (40 existing + 5 new).

### `README.md`

Added documentation for the UploadZone Reset Flow under the UI Components section, covering:
- When the reset button appears (success state).
- What the reset action does (clears file, error, status, input, focuses dropzone).
- The specific scenarios covered by tests.

---

## Testing

```bash
npm test -- --testPathPatterns="UploadZone.test.jsx"

PASS components/UploadZone.test.jsx
  UploadZone
    ...
    GROUP 4: Reset / Upload another invoice flow
      ✓ shows 'Upload another invoice' button in success state
      ✓ clears file, error, and status back to idle after reset
      ✓ reset clears stale error
      ✓ re-upload after reset works correctly
      ✓ focuses the dropzone after reset
    GROUP 5: Accessibility
      ✓ passes axe accessibility check in idle state
      ✓ passes axe accessibility check after file is selected
      ✓ passes axe accessibility check after file validation error

Test Suites: 1 passed, 1 total
Tests:       40 passed, 40 total
```

- ✅ **40/40 tests passing** (35 existing + 5 new)
- ✅ `jest-axe` accessibility checks pass in idle, file-selected, and error states
- ✅ No regressions in GROUP 1 (drag-and-drop), GROUP 2 (keyboard), or GROUP 3 (submit state machine / double-submit guard)
- ✅ Focus management verified via `document.activeElement` assertion

---

## Accessibility

- The success message retains its `role="status"` / `aria-live="polite"` region and clears on reset.
- Error messages retain `role="alert"` / `aria-live="assertive"` and are unaffected by the reset flow.
- The reset button has a descriptive `aria-label` via `copy.uploadZone.resetAriaLabel`.
- After reset, focus moves to the dropzone (`role="button"`, `tabIndex={0}`) so keyboard users can immediately start a new upload without re-navigating.
- No changes to the `disabled`/`aria-disabled` logic on `#invoice-upload-btn` for the idle/processing states.

---

## Security

- No secrets, wallet keys, `.env` files, or generated artifacts are included.
- No API or wallet trust-boundary changes.

---

## Contributor Checklist

- [x] Tests were added or updated for the changed behavior.
- [x] Impacted code meets the 95% coverage expectation.
- [x] Accessibility was verified for UI changes, including keyboard flow, labels, focus states, and contrast.
- [x] Documentation was updated (README.md).
- [x] `npm run lint`, `npm test`, and `npm run build` pass locally.
