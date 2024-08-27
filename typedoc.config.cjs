'use strict';

/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  entryPoints: ['src/index.ts'],
  out: 'docs',
  cleanOutputDir: true,
  sidebarLinks: {
    'GitHub': 'https://github.com/hildjj/foo/',
    'CBOR2 Playground': 'https://hildjj.github.io/cbor2/playground/index.html',
    'Documentation': 'http://hildjj.github.io/foo/',
  },
  navigation: {
    includeCategories: false,
    includeGroups: false,
  },
  categorizeByGroup: false,
  sort: ['static-first', 'alphabetical'],
  exclude: ['**/*.spec.ts'],
};
