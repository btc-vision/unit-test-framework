# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in the OPNet Unit Test Framework, **please do NOT open a public issue**.

Instead, report it privately through one of these channels:

1. **GitHub Security Advisories** (preferred): [Report a vulnerability](https://github.com/btc-vision/unit-test-framework/security/advisories/new)
2. **Email**: security@opnet.org

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix and disclosure**: Coordinated with reporter

## Scope

This policy covers:

- The `@btc-vision/unit-test-framework` npm package
- The OP_VM integration layer (`ContractRuntime`, `RustContract`)
- State management (`StateHandler`, `BytecodeManager`)
- Gas accounting and consensus rule enforcement
- Contract upgrade mechanisms (`updateFromAddress`, `applyPendingBytecodeUpgrade`)

## Out of Scope

- Vulnerabilities in dependencies (report to the respective project)
- Issues in the Rust `@btc-vision/op-vm` crate (report to [op-vm](https://github.com/btc-vision/op-vm))
- Issues in `@btc-vision/btc-runtime` (report to [btc-runtime](https://github.com/btc-vision/btc-runtime))
