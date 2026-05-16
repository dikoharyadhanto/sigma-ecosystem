#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const isWin = process.platform === 'win32';

const memoryFilePath = process.env.MEMORY_FILE_PATH ||
  (isWin
    ? path.join(os.homedir(), '.sigma', 'memory_sigma.jsonl').replace(/\\/g, '/')
    : path.join(os.homedir(), '.sigma', 'memory_sigma.jsonl'));

const env = { ...process.env, MEMORY_FILE_PATH: memoryFilePath };

const cmd = isWin ? 'cmd' : 'npx';
const args = isWin
  ? ['/c', 'npx', '-y', '@modelcontextprotocol/server-memory']
  : ['-y', '@modelcontextprotocol/server-memory'];

const proc = spawn(cmd, args, { stdio: 'inherit', env });
proc.on('exit', (code) => process.exit(code ?? 0));
