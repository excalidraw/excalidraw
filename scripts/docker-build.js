#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const argv = require('minimist')(process.argv.slice(2), {
  string: ['image', 'targetPlatform', 'targetArch'],
  boolean: ['noCache'],
  alias: { image: 'i', targetPlatform: 'p', targetArch: 'a', noCache: 'n' },
  default: { image: 'excalidraw:local', targetPlatform: 'linux/amd64', targetArch: 'amd64' }
});

const image = argv.image;
const targetPlatform = argv.targetPlatform;
const targetArch = argv.targetArch;
const noCache = argv.noCache;

console.log(`Using BuildKit and building image: ${image} for ${targetPlatform} (arch: ${targetArch})`);

process.env.DOCKER_BUILDKIT = '1';

const args = ['build'];
if (noCache) args.push('--no-cache');
args.push('--build-arg', `TARGETPLATFORM=${targetPlatform}`);
args.push('--build-arg', `TARGETARCH=${targetArch}`);
args.push('-t', image, '-f', 'Dockerfile', '.');

const cmd = 'docker';
console.log('Running:', cmd, args.join(' '));

const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
process.exit(res.status);
