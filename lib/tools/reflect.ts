import {
  Component,
  Directive,
  Input,
  NgModule,
  Output,
  Pipe,
  PipeTransform,
  Type,
  ɵReflectionCapabilities,
} from '@angular/core';

type IODefinition = { propertyName: string; alias: string };

type InputsAndOutputs = {
  inputs: IODefinition[];
  outputs: IODefinition[];
};

type PropDecorators = Record<
  string,
  {
    type: any;
    args?: any[];
  }[]
>;

const reflection = new ɵReflectionCapabilities();
const getAnnotation = <TType extends Directive | Component | Pipe | NgModule>(
  type: Type<TType>,
  thing: Type<any>,
): TType | null => {
  const annotations = reflection.annotations(thing);
  // Try to find the nearest known Type annotation and make sure that this annotation is an
  // instance of the type we are looking for, so we can use it for resolution. Note: there might
  // be multiple known annotations found due to the fact that Components can extend Directives (so
  // both Directive and Component annotations would be present), so we always check if the known
  // annotation has the right type.
  for (let i = annotations.length - 1; i >= 0; i--) {
    const annotation = annotations[i];
    const isKnownType =
      annotation instanceof Directive ||
      annotation instanceof Component ||
      annotation instanceof Pipe ||
      annotation instanceof NgModule;
    if (isKnownType) {
      return annotation instanceof type ? annotation : null;
    }
  }
  return null;
};

const resolveDirectiveInputsAndOutputs = (componentOrDirective: any) => {
  const metadata = reflect.resolveDirective(componentOrDirective);
  const interatorMap = [
    { key: 'inputs', type: Input },
    { key: 'outputs', type: Output },
  ] as const;
  return interatorMap.reduce<PropDecorators>((acc, { key, type }) => {
    const normalized = metadata[key]?.map(a => (typeof a === 'string' ? { name: a } : a));
    return {
      ...acc,
      ...normalized?.reduce<PropDecorators>((acc2, i) => ({ ...acc2, [i.name]: [{ type }] }), {}),
    };
  }, {});
};

export const reflect = {
  resolveComponent: (thing: any) => getAnnotation(Component, thing) || {},
  resolveDirective: (thing: any) => getAnnotation(Directive, thing) || {},
  resolveModule: (thing: any) => getAnnotation(NgModule, thing) || {},
  resolvePipe: (thing: any) => getAnnotation(Pipe, thing),
  isComponent: (thing: any) => !!getAnnotation(Component, thing),

  isDirective: (thing: any) => !!getAnnotation(Directive, thing),
  isNgModule: (thing: any) => !!getAnnotation(NgModule, thing),
  isPipe: (thing: any): thing is PipeTransform => !!getAnnotation(Pipe, thing),

  isStandalone: (thing: any): boolean =>
    !!(getAnnotation(Directive, thing)?.standalone || getAnnotation(Pipe, thing)?.standalone),

  getInputsAndOutputs(componentOrDirective: any): InputsAndOutputs {
    let propDecorators: PropDecorators = {};
    let currentComponent = componentOrDirective;
    // Walk up the prototype tree to find inherited in/outputs
    do
      propDecorators = {
        ...currentComponent.propDecorators,
        ...resolveDirectiveInputsAndOutputs(currentComponent),
        ...propDecorators,
      };
    while ((currentComponent = Object.getPrototypeOf(currentComponent)) && typeof currentComponent === 'function');

    const getAlias = (input: { type: any; args?: any[] }, key: string) => {
      const firstArg = input.args?.[0];
      if (!firstArg) {
        return key;
      }
      if (typeof firstArg === 'string') {
        return firstArg;
      }
      return firstArg?.alias || key;
    };

    return Object.entries(propDecorators).reduce<InputsAndOutputs>(
      (acc, [key, value]) => {
        const input = value.find(v => v.type === Input);
        if (input) {
          return {
            ...acc,
            inputs: [...acc.inputs, { propertyName: key, alias: getAlias(input, key) }],
          };
        }

        const output = value.find(v => v.type === Output);
        if (output) {
          return {
            ...acc,
            outputs: [...acc.outputs, { propertyName: key, alias: getAlias(output, key) }],
          };
        }
        return acc;
      },
      { inputs: [], outputs: [] },
    );
  },
};
