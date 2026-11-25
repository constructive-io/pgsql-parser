import { Enum, Field,Type } from '@launchql/protobufjs';

import { NODE_TYPE } from '../constants';
import { isPrimitiveType } from './types';

const dependenciesResolve = (types: Type[], enums: Enum[], symbolName: string, resolved: string[], unresolved: string[]) => {
  if (symbolName === NODE_TYPE) return;

  unresolved.push(symbolName);

  let dep = [...types, ...enums].find(dep => dep.name === symbolName);
  if (!dep) {
    throw new Error(`Dependency Not Found ${symbolName}`);
  }

  const depAsType = types.find(t => t.name === dep.name);

  if (depAsType) {
    const fields = Object.values(depAsType.fields);
    for (let i = 0; i < fields.length; i++) {
      const childDep = fields[i];
      if (!resolved.includes(childDep.type)) {
        if (unresolved.includes(childDep.type)) {
          // console.warn(`Circular reference detected ${symbolName}, ${dep}`);
          continue;
        }
        if (!isPrimitiveType(childDep.type)) {
          dependenciesResolve(types, enums, childDep.type, resolved, unresolved);
        }
      }
    }   
  }
  resolved.push(symbolName);
  const index = unresolved.indexOf(symbolName);
  unresolved.splice(index);
};

export const getDependencies = (name: string, types: Type[], enums: Enum[]) => {
  const resolved: string[] = [];
  const unresolved: string[] = [];
  dependenciesResolve(types, enums, name, resolved, unresolved);
  return resolved;
};

const dependentsResolve = (types: Type[], enums: Enum[], symbolName: string, resolved: string[], unresolved: string[]) => {
  if (symbolName === NODE_TYPE) return;

  unresolved.push(symbolName);

  [...types, ...enums].forEach(dep => {
    if (resolved.includes(dep.name) || unresolved.includes(dep.name)) {
      return;
    }

    const depAsType = types.find(t => t.name === dep.name);

    let isDependent = false;
    if (depAsType) {
      const fields: Field[] = Object.values(depAsType.fields);
      isDependent = fields.some(field => field.type === symbolName);
    } 

    if (isDependent) {
      if (unresolved.includes(dep.name)) {
        throw new Error(`Circular reference detected: ${symbolName} <-> ${dep.name}`);
      }

      dependentsResolve(types, enums, dep.name, resolved, unresolved);
    }
  });

  if (!resolved.includes(symbolName)) {
    resolved.push(symbolName);
  }

  const index = unresolved.indexOf(symbolName);
  if (index !== -1) {
    unresolved.splice(index, 1);
  }
};

export const getDependents = (symbolName: string, types: Type[], enums: Enum[]) => {
  const resolved: string[] = [];
  const unresolved: string[] = [];
  dependentsResolve(types, enums, symbolName, resolved, unresolved);
  return resolved.filter(name => name !== symbolName); // Exclude the symbol itself from its dependents
};
