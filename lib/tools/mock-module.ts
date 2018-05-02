import { ModuleWithProviders, NgModule, Type } from '@angular/core';
import { MockOf } from 'ng-mocks';
import { isModuleWithProviders } from './type-checkers';
import { ngMock } from './ng-mock';
import { mockProvider } from './mock-provider';
import { TestSetup } from '../models/test-setup';
import { getNgModuleAnnotations } from './get-ng-module-annotations';

export type AnyNgModule = any[] | Type<any> | ModuleWithProviders;
export function mockModule<TModule extends AnyNgModule>(mod: TModule, setup: TestSetup<any>): TModule {
  const cached = setup.mockCache.find(mod);
  if (cached) {
    return cached;
  }
  if (Array.isArray(mod)) {
    return setup.mockCache.add(mod, mod.map(i => mockModule(i, setup))) as TModule; // Recursion
  } else if (isModuleWithProviders(mod)) {
    // If we have a moduleWithProviders, make sure we return the same
    return {
      ngModule: mockModule(mod.ngModule, setup), // Recursion
      providers: mod.providers && mod.providers.map(p => mockProvider(p, setup))
    } as TModule;
  } else if (typeof mod !== 'function') {
    throw new Error(`Don't know how to mock module: ${mod}`);
  }

  const modClass = mod as Type<any>;
  const replacementModule = setup.moduleReplacements.get(modClass);
  if (replacementModule) {
    return setup.mockCache.add(mod, replacementModule) as TModule;
  }

  const {imports, declarations, exports, entryComponents, providers} = getNgModuleAnnotations(modClass);
  const mockedModule: NgModule = {
    imports: ngMock(imports, setup),
    declarations: ngMock(declarations, setup),
    exports: ngMock(exports, setup),
    entryComponents: ngMock(entryComponents, setup),
    providers: providers.map(p => mockProvider(p, setup)),
  };
  @NgModule(mockedModule)
  @MockOf(modClass)
  class MockModule {}

  return setup.mockCache.add(mod, MockModule) as TModule;
}
