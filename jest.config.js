const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Handle CSS and static assets
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jose|@testing-library|@radix-ui|@supabase|next)/)',
  ],
  testMatch: [
    '**/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)',
  ],
  testPathIgnorePatterns: [
    '__tests__/regression/framework.ts',
    'node_modules/',
    '\\.next/',
    'e2e/', // Exclude Playwright tests from Jest execution
    '.*\\.spec\\.ts$', // Exclude Playwright spec files
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',
    '!**/scripts/**',
  ],
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  // Mock globals for Node.js compatibility
  globals: {
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder,
  },
}

module.exports = createJestConfig(customJestConfig)