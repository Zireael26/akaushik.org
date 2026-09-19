import next from 'eslint-config-next';

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      'node_modules/**',
      'worker/demo-env.d.ts',
    ],
  },
  ...next,
  {
    rules: {
      'import/no-anonymous-default-export': 'off',
    },
  },
];

export default config;
