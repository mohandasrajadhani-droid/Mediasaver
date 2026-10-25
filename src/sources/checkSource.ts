/** The one function the UI calls: pasted text in → SourceCheck out. */
import { checkDirectUrl } from './directMedia';
import { checkArchiveItem } from './internetArchive';
import type { SourceCheck } from './types';
import { routeUrl } from './urlRules';

export async function checkSource(input: string, fetchImpl: typeof fetch = fetch): Promise<SourceCheck> {
  const route = routeUrl(input);
  switch (route.type) {
    case 'final':
      return route.result;
    case 'archive':
      return checkArchiveItem(route.identifier, fetchImpl);
    case 'direct':
      return checkDirectUrl(route.url, fetchImpl);
  }
}

export type { SourceCheck, MediaOption } from './types';
