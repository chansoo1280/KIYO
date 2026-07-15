import "fake-indexeddb/auto";

// Mock TextEncoder and TextDecoder
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;
// Export mock for use in tests
export {};
