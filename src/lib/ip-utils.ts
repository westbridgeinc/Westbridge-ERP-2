/**
 * IP address utilities — CIDR matching and validation.
 */
import { isIPv4 } from "net";

export interface CidrRange {
  network: string;
  prefix: number;
}

/** Convert a dotted-quad IPv4 address to a 32-bit unsigned integer. */
export function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/** Check if an IP address falls within a CIDR range. */
export function isInCidr(ip: string, network: string, prefix: number): boolean {
  const mask = (~0 << (32 - prefix)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(network) & mask);
}

/** Check if an IP address matches any of the given CIDR ranges. */
export function matchesCidr(ip: string, ranges: CidrRange[]): boolean {
  const trimmed = ip.trim();
  if (!isIPv4(trimmed)) return false;
  return ranges.some(({ network, prefix }) => isInCidr(trimmed, network, prefix));
}
