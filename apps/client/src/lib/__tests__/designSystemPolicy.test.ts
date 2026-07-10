/// <reference types="node" />

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '../../../../..');

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
}

function readSourceFiles(root: string): Array<{ path: string; contents: string }> {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return readSourceFiles(path);
    }

    if (path.includes('__tests__') || !/\.(scss|css|ts|tsx|html)$/.test(entry)) {
      return [];
    }

    return [{ path, contents: readFileSync(path, 'utf8') }];
  });
}

describe('design system dependency policy', () => {
  it('keeps Tabler owned by the shared theme package', () => {
    const clientPackage = readPackageJson(join(repoRoot, 'apps/client/package.json'));
    const themePackage = readPackageJson(join(repoRoot, 'packages/theme/package.json'));

    expect(clientPackage.dependencies).not.toHaveProperty('@tabler/core');
    expect(clientPackage.devDependencies).not.toHaveProperty('@tabler/core');
    expect(themePackage.dependencies).toHaveProperty('@tabler/core');
  });

  it('does not introduce jQuery, Bootstrap, or template dependencies into app manifests', () => {
    const manifests = [
      join(repoRoot, 'apps/client/package.json'),
      join(repoRoot, 'packages/theme/package.json'),
    ];
    const forbiddenDependencies = ['jquery', 'bootstrap', 'maxton'];

    for (const manifest of manifests) {
      const packageJson = readPackageJson(manifest);
      const dependencyNames = [
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.devDependencies ?? {}),
      ];

      expect(dependencyNames).not.toEqual(expect.arrayContaining(forbiddenDependencies));
    }
  });

  it('keeps Maxton and jQuery code out of client and theme sources', () => {
    const files = [
      ...readSourceFiles(join(repoRoot, 'apps/client/src')),
      ...readSourceFiles(join(repoRoot, 'packages/theme/src')),
    ];
    const forbiddenPatterns = [/\bmaxton\b/i, /\bjQuery\b/, /\$\(\s*['"`.[#a-zA-Z]/];

    const violations = files.flatMap((file) =>
      forbiddenPatterns
        .filter((pattern) => pattern.test(file.contents))
        .map((pattern) => `${relative(repoRoot, file.path)}: ${pattern}`)
    );

    expect(violations).toEqual([]);
  });
});
