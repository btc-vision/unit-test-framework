import { execSync } from 'node:child_process';

const root = process.cwd();
process.chdir(`${root}/test/e2e/contracts/test-contract/contract`);
execSync('asc index.ts --target debug --measure --uncheckedBehavior never');

process.chdir(`${root}/test/e2e/contracts/gas-test-contract/contract`);
execSync('asc GasTestContract.ts --target debug --measure --uncheckedBehavior never');

process.chdir(`${root}/test/e2e/contracts/upgradeable-contract/contract`);
execSync('asc index.ts --target debug --measure --uncheckedBehavior never');

process.chdir(`${root}/test/e2e/contracts/upgradeable-contract-v2/contract`);
execSync('asc index.ts --target debug --measure --uncheckedBehavior never');

process.chdir(`${root}/test/e2e/contracts/ecdsa-contract/contract`);
execSync('asc index.ts --target debug --measure --uncheckedBehavior never');
