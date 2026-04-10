/** Always resolves in the browser (no fake TLDs like `.example`). */
export function searchUrl(query: string): string {
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
}

export function websiteUrlForStartup(name: string): string {
  return searchUrl(`${name} company official website`)
}

/** “Latest” reference for demo data (public directories / news). */
export const PRIMARY_DATA_SOURCE = {
  label: 'Crunchbase Discover',
  url: 'https://www.crunchbase.com/discover/organization/abstractions',
} as const

export function dataSourceUrlForStartup(name: string): string {
  return searchUrl(`${name} startup funding news`)
}

export function isBrokenDemoWebsite(url: string | null | undefined): boolean {
  if (!url || !url.startsWith('http')) return true
  return /\.example(\/|$)/i.test(url) || url.includes('lumenstack.example')
}
