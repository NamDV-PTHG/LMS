/**
 * CommonJS wrapper để chạy worker.ts qua PM2 trên Windows.
 * Giải quyết: ERR_UNKNOWN_FILE_EXTENSION, moduleResolution bundler, @/ path alias.
 */
const path = require('path');
const root = path.resolve(__dirname, '../../');

// Resolve path aliases (@/* → src/*)
require('tsconfig-paths').register({
  baseUrl: root,
  paths: { '@/*': ['src/*'] },
});

// Load TypeScript với CommonJS mode
require('ts-node').register({
  transpileOnly: true,
  project: path.join(root, 'tsconfig.json'),
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'node',
    esModuleInterop: true,
  },
});

require('./worker.ts');
