import { Enum } from '@launchql/protobufjs';

type EnumValueToName = Record<string, Record<number, string>>;
type EnumNameToValue = Record<string, Record<string, number>>;

/**
 * Generates a JSON structure mapping enum numeric values to their string names.
 * Output format: { EnumName: { 0: 'VALUE1', 1: 'VALUE2', ... } }
 * Used for creating enum-to-string mapping files (JSON or TypeScript).
 */
export const generateEnum2StrJSON = (enums: Enum[]): EnumValueToName => {
  const valueToName: EnumValueToName = {};

  enums.forEach(enumObj => {
    valueToName[enumObj.name] = {};

    for (const [key, value] of Object.entries(enumObj.values)) {
      valueToName[enumObj.name][value as number] = key;
    }
  });

  return valueToName;
};

/**
 * Generates a JSON structure mapping enum string names to their numeric values.
 * Output format: { EnumName: { 'VALUE1': 0, 'VALUE2': 1, ... } }
 * Used for creating string-to-enum mapping files (JSON or TypeScript).
 */
export const generateEnum2IntJSON = (enums: Enum[]): EnumNameToValue => {
  const nameToValue: EnumNameToValue = {};

  enums.forEach(enumObj => {
    nameToValue[enumObj.name] = {};

    for (const [key, value] of Object.entries(enumObj.values)) {
      nameToValue[enumObj.name][key] = value as number;
    }
  });

  return nameToValue;
};