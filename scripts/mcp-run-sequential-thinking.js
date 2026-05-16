#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');

const isWin = process.platform === 'win32';
const cmd = isWin ? 'cmd' : 'npx';
const args = isWin
  ? ['/c', 'npx', '-y', '@modelcontextprotocol/server-sequential-thinking']
  : ['-y', '@modelcontextprotocol/server-sequential-thinking'];

const proc = spawn(cmd, args, { stdio: 'inherit', env: process.env });
proc.on('exit', (code) => process.exit(code ?? 0));
