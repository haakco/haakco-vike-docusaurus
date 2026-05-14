#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { buildDocusaurusSite } from './index.js';

const readFlag = (flag: string) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
};

const rootDir = readFlag('--root');
const siteDir = readFlag('--site-dir');
const outputDir = readFlag('--output-dir');
const tempRootDir = readFlag('--temp-root-dir');

const main = async () => {
  const resolvedRoot = path.resolve(rootDir ?? process.cwd());

  await buildDocusaurusSite({
    rootDir: resolvedRoot,
    siteDir,
    outputDir,
    tempRootDir,
    log: (message) => {
      console.log(`[haakco:vike-plugin-docusaurus] ${message}`);
    },
  });
};

main().catch((error) => {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  console.error(normalizedError.message);
  process.exitCode = 1;
});
