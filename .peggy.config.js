export default {
  dts: true,
  format: 'es',
  input: 'src/edn.peggy',
  output: 'lib/edn.js',
  allowedStartRules: [
    // 'seq',
    // 'one_item',
    '*',
  ],
  returnTypes: {
    seq: 'Uint8Array[]',
    one_item: 'Uint8Array',
  },
};
