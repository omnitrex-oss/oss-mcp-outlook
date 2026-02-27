/**
 * OData pagination helper.
 * Follows @odata.nextLink up to a configurable page limit.
 */

export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  nextLink?: string;
}

/**
 * Collect items from a paginated Graph API response.
 * Uses the provided fetch function to follow nextLink pages.
 */
export async function paginate<T>(
  fetchPage: (url: string) => Promise<{ value: T[]; "@odata.nextLink"?: string }>,
  initialUrl: string,
  maxPages: number = 10,
): Promise<PaginatedResult<T>> {
  const items: T[] = [];
  let url: string | undefined = initialUrl;
  let pageCount = 0;

  while (url && pageCount < maxPages) {
    const response = await fetchPage(url);
    items.push(...response.value);
    url = response["@odata.nextLink"];
    pageCount++;
  }

  return {
    items,
    hasMore: !!url,
    nextLink: url,
  };
}
