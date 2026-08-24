/**
 * URL/Domain utility functions for Autofill Service integration
 */

/**
 * Extracts the normalized domain from a URL for autofill matching.
 * 
 * Examples:
 * - "https://www.naver.com/login" -> "naver.com"
 * - "https://login.microsoftonline.com/" -> "login.microsoftonline.com"
 * - "http://localhost:3000" -> "localhost"
 * - "https://sub.domain.example.co.kr/path" -> "sub.domain.example.co.kr"
 * 
 * @param url - The URL to extract domain from
 * @returns Normalized domain string, or null if invalid URL
 */
export function extractDomain(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Add protocol if missing to ensure proper parsing
    const urlWithProtocol = url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`;

    const parsedUrl = new URL(urlWithProtocol);
    let hostname = parsedUrl.hostname;

    // Remove port if present (e.g., "localhost:3000" -> "localhost")
    if (hostname.includes(':')) {
      hostname = hostname.split(':')[0];
    }

    // Convert to lowercase
    hostname = hostname.toLowerCase();

    // Remove "www." prefix if present
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    // Validate that we have a valid domain
    if (!hostname || hostname === 'localhost' || isValidDomain(hostname)) {
      return hostname;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validates if a string is a valid domain name
 */
function isValidDomain(domain: string): boolean {
  // Basic domain validation: must contain at least one dot and valid characters
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
  return domainRegex.test(domain);
}

/**
 * Extracts domain from URL and also returns the original URL for storage
 * 
 * @param url - The URL to process
 * @returns Object containing original URL and extracted domain
 */
export function processWebsiteUrl(url: string): { websiteUrl: string; domain: string | null } {
  const trimmedUrl = url.trim();
  const domain = extractDomain(trimmedUrl);
  return {
    websiteUrl: trimmedUrl,
    domain
  };
}

/**
 * Checks if a URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlWithProtocol = url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`;
    new URL(urlWithProtocol);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalizes a domain for comparison (lowercase, no www prefix)
 */
export function normalizeDomain(domain: string): string {
  if (!domain) return '';
  return domain.toLowerCase().replace(/^www\./, '');
}

/**
 * Checks if two domains match for autofill purposes
 * Handles subdomain matching (e.g., login.example.com matches example.com)
 */
export function domainsMatch(domain1: string, domain2: string): boolean {
  const normalized1 = normalizeDomain(domain1);
  const normalized2 = normalizeDomain(domain2);
  
  if (normalized1 === normalized2) return true;
  
  // Check if one is a subdomain of the other
  // e.g., login.example.com matches example.com
  return normalized1.endsWith(`.${normalized2}`) || normalized2.endsWith(`.${normalized1}`);
}