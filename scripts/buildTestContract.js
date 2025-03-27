import { execSync } from 'node:child_process';

process.chdir('./test/e2e/test-contract/contract');
execSync('asc index.ts --target debug --measure --uncheckedBehavior never');
