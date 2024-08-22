export const MT = {
  ELLIPSIS: -8,
  ENCODED_STR: -3, // Do not prefix with length
  ENCODED_BYTES: -2, // Do not prefix with length
  CUSTOM: -1,
  POS_INT: 0,
  NEG_INT: 1,
  BYTE_STRING: 2,
  UTF8_STRING: 3,
  ARRAY: 4,
  MAP: 5,
  TAG: 6,
  SIMPLE_FLOAT: 7,
};

export const ELLIPSE_TAG = 888;
export const CUSTOM_APP_TAG = 999;
export const IPV4_TAG = 52;
export const IPV6_TAG = 54;
