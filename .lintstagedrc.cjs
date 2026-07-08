module.exports = {
  'apps/api/**/*.php': [
    (filenames) => `cd apps/api && ./vendor/bin/pint ${filenames.join(' ')}`,
    (filenames) => `cd apps/api && ./vendor/bin/phpstan analyse --memory-limit=512M --no-progress`,
  ],
  'apps/client/**/*.{ts,tsx}': [
    (filenames) => `cd apps/client && pnpm exec eslint --fix ${filenames.join(' ')}`,
    (filenames) => `cd apps/client && pnpm exec prettier --write ${filenames.join(' ')}`,
  ],
  'apps/client/**/*.{css,scss}': [
    (filenames) => `cd apps/client && pnpm exec prettier --write ${filenames.join(' ')}`,
  ],
  'packages/**/*.{ts,tsx}': [
    (filenames) => `cd apps/client && pnpm exec eslint --fix ${filenames.join(' ')}`,
    (filenames) => `cd apps/client && pnpm exec prettier --write ${filenames.join(' ')}`,
  ],
}
