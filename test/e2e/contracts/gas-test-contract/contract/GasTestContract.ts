export function execute(_: u32): u32 {
    memory.grow(1);
    store<u8>(31, 3);
    store<u8>(63, 5);
    env_store(0, 32);
    return 0;
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
