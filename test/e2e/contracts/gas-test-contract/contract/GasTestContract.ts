export function execute(selector: u32): u32 {
    if (selector === 0) {
        return 0;
    }

    if (selector === 1) {
        return 1;
    }

    if (selector === 2) {
        memory.grow(1);
        store<u8>(31, 3);
        store<u8>(63, 5);
        env_store(0, 32);
        return 0
    }

    return 1;
}

export function onDeploy(_: u32): u32 {
    return 0;
}

// @ts-ignore
@external('env', 'store')
declare function env_store(keyPtr: u32, valuePtr: u32): void;

// @ts-ignore
@external('env', 'load')
declare function env_load(keyPtr: u32): u32;
