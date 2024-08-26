export default {
  dts: true,
  format: 'es',
  input: 'src/edn.peggy',
  output: 'lib/edn.js',
  allowedStartRules: [
    // 'seq',
    // 'one_item',
    // 'app_string_h',
    // 'app_string_b64',
    // 'app_string_dt',
    // 'app_string_ip',

    '*',
  ],
  returnTypes: {
    seq: 'Uint8Array[]',
    one_item: 'Uint8Array',
  },
};
