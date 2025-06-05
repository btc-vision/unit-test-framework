import { execSync } from 'node:child_process';

const root = process.cwd();
process.chdir(`${root}/test/e2e/contracts/test-contract/contract`);
execSync('asc index.ts --config asconfig.json --target debug --measure --uncheckedBehavior never');

process.chdir(`${root}/test/e2e/contracts/gas-test-contract/contract`);
execSync(
    'asc GasTestContract.ts --config asconfig.json --target debug --measure --uncheckedBehavior never',
);
