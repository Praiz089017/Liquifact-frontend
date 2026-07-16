import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// Expose `axe` so tests that don't import it (the existing a11y suites) can
// still call `axe(container)` directly.
globalThis.axe = axe;