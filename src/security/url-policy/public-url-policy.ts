import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type RuntimeEnvironment = 'development' | 'production';

/** Resolves a hostname to every address returned by the operating system DNS APIs. */
export type HostnameResolver = (hostname: string) => Promise<readonly string[]>;

export class PublicUrlPolicyError extends Error {
  readonly code = 'URL_NOT_PUBLIC' as const;

  constructor() {
    super('The URL must resolve to a public address.');
    this.name = 'PublicUrlPolicyError';
  }
}

export class PublicUrlPolicy {
  constructor(private readonly hostnameResolver: HostnameResolver = resolveHostnameWithNode) {}

  enforce(url: URL, environment: RuntimeEnvironment): void {
    if (environment !== 'production') {
      return;
    }

    const hostname = normalizeHostname(url.hostname);
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      throw new PublicUrlPolicyError();
    }

    if (isNonPublicIpAddress(hostname)) {
      throw new PublicUrlPolicyError();
    }
  }

  async resolveHostname(hostname: string): Promise<readonly string[]> {
    const normalizedHostname = normalizeHostname(hostname);
    if (isIP(normalizedHostname) !== 0) {
      return [normalizedHostname];
    }

    return this.hostnameResolver(normalizedHostname);
  }
}

const defaultPublicUrlPolicy = new PublicUrlPolicy();

export function enforcePublicUrlPolicy(url: URL, environment: RuntimeEnvironment): void {
  defaultPublicUrlPolicy.enforce(url, environment);
}

async function resolveHostnameWithNode(hostname: string): Promise<readonly string[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address }) => address);
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function isNonPublicIpAddress(hostname: string): boolean {
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    return isNonPublicIpv4(parseIpv4(hostname));
  }

  if (ipVersion === 6) {
    return isNonPublicIpv6(parseIpv6(hostname));
  }

  return false;
}

function parseIpv4(address: string): number {
  return address.split('.').reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

function isNonPublicIpv4(address: number): boolean {
  return (
    isInIpv4Range(address, '0.0.0.0', 8) ||
    isInIpv4Range(address, '10.0.0.0', 8) ||
    isInIpv4Range(address, '100.64.0.0', 10) ||
    isInIpv4Range(address, '127.0.0.0', 8) ||
    isInIpv4Range(address, '169.254.0.0', 16) ||
    isInIpv4Range(address, '172.16.0.0', 12) ||
    isInIpv4Range(address, '192.0.0.0', 24) ||
    isInIpv4Range(address, '192.0.2.0', 24) ||
    isInIpv4Range(address, '192.88.99.0', 24) ||
    isInIpv4Range(address, '192.168.0.0', 16) ||
    isInIpv4Range(address, '198.18.0.0', 15) ||
    isInIpv4Range(address, '198.51.100.0', 24) ||
    isInIpv4Range(address, '203.0.113.0', 24) ||
    isInIpv4Range(address, '224.0.0.0', 4) ||
    isInIpv4Range(address, '240.0.0.0', 4)
  );
}

function isInIpv4Range(address: number, network: string, prefixLength: number): boolean {
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (address & mask) === (parseIpv4(network) & mask);
}

function parseIpv6(address: string): bigint {
  const [head = '', tail = ''] = address.split('::');
  const headParts = head === '' ? [] : head.split(':');
  const tailParts = tail === '' ? [] : tail.split(':');
  const omittedPartCount = 8 - headParts.length - tailParts.length;
  const parts = [...headParts, ...Array<string>(omittedPartCount).fill('0'), ...tailParts];

  return parts.reduce((value, part) => (value << 16n) + BigInt(`0x${part}`), 0n);
}

function isNonPublicIpv6(address: bigint): boolean {
  if (isIpv4CompatibleOrMapped(address)) {
    return isNonPublicIpv4(Number(address & 0xffffffffn));
  }

  return (
    isInIpv6Range(address, '::', 128) ||
    isInIpv6Range(address, '::1', 128) ||
    isInIpv6Range(address, '64:ff9b:1::', 48) ||
    isInIpv6Range(address, '100::', 64) ||
    isInIpv6Range(address, '2001::', 23) ||
    isInIpv6Range(address, '2001:db8::', 32) ||
    isInIpv6Range(address, '2002::', 16) ||
    isInIpv6Range(address, '3fff::', 20) ||
    isInIpv6Range(address, '5f00::', 16) ||
    isInIpv6Range(address, 'fc00::', 7) ||
    isInIpv6Range(address, 'fe80::', 10) ||
    isInIpv6Range(address, 'ff00::', 8)
  );
}

function isIpv4CompatibleOrMapped(address: bigint): boolean {
  const first96Bits = address >> 32n;
  return first96Bits === 0n || first96Bits === 0xffffn;
}

function isInIpv6Range(address: bigint, network: string, prefixLength: number): boolean {
  const shift = 128n - BigInt(prefixLength);
  return (address >> shift) === (parseIpv6(network) >> shift);
}
