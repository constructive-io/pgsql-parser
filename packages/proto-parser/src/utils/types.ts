export const isPrimitiveType = (type: string) => {
  switch (type) {
  case 'string':
  case 'double':
  case 'float':
  case 'int32':
  case 'uint32':
  case 'sint32':
  case 'fixed32':
  case 'sfixed32':
  case 'int64':
  case 'uint64':
  case 'sint64':
  case 'fixed64':
  case 'sfixed64':
  case 'bytes':
  case 'bool':
    return true;
  default:
    return false;
  };
};