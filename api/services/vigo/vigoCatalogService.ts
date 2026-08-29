import { vigoCache } from './vigoCacheService';

const CKAN_BASE_URL = process.env.VIGO_CKAN_BASE_URL || 'https://datos-ckan.vigo.org';

export type DatasetInfo = {
  id: string;
  title: string;
  tags: string[];
  resources: { url: string; format: string; last_modified: string }[];
  license: string;
  source_url: string;
  retrieved_at: string;
};

export class VigoCatalogService {
  async getPackageList(): Promise<string[]> {
    const cacheKey = 'vigo_package_list';
    const cached = vigoCache.get<string[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${CKAN_BASE_URL}/api/3/action/package_list`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (data.success) {
        vigoCache.set(cacheKey, data.result, 3600 * 24); // Cache for 24h
        return data.result;
      }
      return [];
    } catch (error) {
      console.error('[VigoCatalogService] Error fetching package list:', error);
      return [];
    }
  }

  async searchPackages(query: string): Promise<DatasetInfo[]> {
    const cacheKey = `vigo_package_search_${query}`;
    const cached = vigoCache.get<DatasetInfo[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${CKAN_BASE_URL}/api/3/action/package_search?q=${encodeURIComponent(query)}&rows=100`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (data.success && data.result?.results) {
        const datasets = data.result.results.map((pkg: any) => this.mapPackageToDatasetInfo(pkg));
        vigoCache.set(cacheKey, datasets, 3600); // Cache for 1h
        return datasets;
      }
      return [];
    } catch (error) {
      console.error('[VigoCatalogService] Error searching packages:', error);
      return [];
    }
  }

  async getPackageDetails(id: string): Promise<DatasetInfo | null> {
    const cacheKey = `vigo_package_show_${id}`;
    const cached = vigoCache.get<DatasetInfo>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${CKAN_BASE_URL}/api/3/action/package_show?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (data.success && data.result) {
        const dataset = this.mapPackageToDatasetInfo(data.result);
        vigoCache.set(cacheKey, dataset, 3600); // Cache for 1h
        return dataset;
      }
      return null;
    } catch (error) {
      console.error('[VigoCatalogService] Error fetching package details:', error);
      return null;
    }
  }

  private mapPackageToDatasetInfo(pkg: any): DatasetInfo {
    return {
      id: pkg.id,
      title: pkg.title,
      tags: pkg.tags ? pkg.tags.map((t: any) => t.name) : [],
      resources: pkg.resources ? pkg.resources.map((r: any) => ({
        url: r.url,
        format: r.format,
        last_modified: r.last_modified
      })) : [],
      license: pkg.license_title || 'Unknown',
      source_url: `${CKAN_BASE_URL}/dataset/${pkg.name}`,
      retrieved_at: new Date().toISOString()
    };
  }
}

export const catalogService = new VigoCatalogService();
