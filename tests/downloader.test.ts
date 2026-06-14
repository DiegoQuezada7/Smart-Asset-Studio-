import { describe, it, expect } from 'vitest';

describe('downloader', () => {
  it('should handle empty results gracefully', async () => {
    const { downloadAsZip } = await import('@/app/utils/downloader');
    await expect(downloadAsZip([])).resolves.not.toThrow();
  });
});
