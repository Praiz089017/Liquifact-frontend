const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Run jest.setup.js after Jest's test framework is installed so its
  // expect.extend() calls (jest-dom, jest-axe) apply to every test file.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Playwright e2e specs live under ./tests and use @playwright/test,
  // which is not a Jest runtime. Keep them out of Jest's collection.
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '<rootDir>/tests/'],
};

module.exports = createJestConfig(customJestConfig);