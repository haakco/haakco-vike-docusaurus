import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { matchesMountPath, resolveStaticFileCandidate } from './index.js';

const temporaryDirectories: string[] = [];

const createFixtureDir = async (files: Record<string, string>) => {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'docusaurus-static-'));
  temporaryDirectories.push(fixtureRoot);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(fixtureRoot, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, contents);
  }

  return fixtureRoot;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe('matchesMountPath', () => {
  it('matches only the configured mount path boundary', () => {
    expect(matchesMountPath('/docs', '/docs')).toBe(true);
    expect(matchesMountPath('/docs/', '/docs')).toBe(true);
    expect(matchesMountPath('/docs/intro', '/docs')).toBe(true);
    expect(matchesMountPath('/docs-old', '/docs')).toBe(false);
    expect(matchesMountPath('/documentation', '/docs')).toBe(false);
  });
});

describe('resolveStaticFileCandidate', () => {
  it('resolves docs files inside the output directory', async () => {
    const baseDir = await createFixtureDir({
      'index.html': 'home',
      'guide/index.html': 'guide',
    });

    await expect(resolveStaticFileCandidate(baseDir, '/docs/', '/docs')).resolves.toBe(
      path.join(baseDir, 'index.html'),
    );
    await expect(resolveStaticFileCandidate(baseDir, '/docs/guide', '/docs')).resolves.toBe(
      path.join(baseDir, 'guide/index.html'),
    );
  });

  it('rejects traversal outside the output directory', async () => {
    const baseDir = await createFixtureDir({
      'index.html': 'home',
    });

    await expect(
      resolveStaticFileCandidate(baseDir, '/docs/../../package.json', '/docs'),
    ).resolves.toBeNull();
  });
});
