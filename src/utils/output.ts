import chalk from 'chalk';

export function success(msg: string): void {
  console.log(chalk.green(msg));
}

export function info(msg: string): void {
  console.log(chalk.cyan(msg));
}

export function warn(msg: string): void {
  console.log(chalk.yellow(msg));
}

export function error(msg: string): never {
  console.error(chalk.red(`Error: ${msg}`));
  process.exit(1);
}

export function section(title: string): void {
  console.log(`\n--- ${title} ---`);
}

export function table(rows: string[][]): void {
  if (rows.length === 0) return;

  const colWidths = rows[0].map((_, colIdx) =>
    Math.max(...rows.map(row => (row[colIdx] ?? '').length))
  );

  for (const row of rows) {
    const line = row.map((cell, i) => (cell ?? '').padEnd(colWidths[i])).join('  ');
    console.log(line);
  }
}
