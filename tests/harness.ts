let pass = 0, fail = 0;
export function check(name: string, ok: boolean, info = ''): void {
  if (ok) pass++;
  else {
    fail++;
    console.log(`  FAIL ${name} ${info}`);
  }
}
export function done(file: string): void {
  console.log(`${fail ? 'FAIL' : 'ok  '} ${file}: ${pass}/${pass + fail}`);
  if (fail) process.exit(1);
}
