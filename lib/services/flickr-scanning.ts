// Placeholder for Flickr scanning service - not implemented yet
export const flickrScanningService = {
  performScan: async () => ({
    totalFound: 0,
    processed: 0,
    approved: 0,
    rejected: 0,
    duplicates: 0,
    errors: []
  }),
  testConnection: async () => ({
    success: false,
    message: 'Flickr service not implemented'
  }),
  getServiceHealth: async () => ({
    isHealthy: false,
    message: 'Flickr service not implemented'
  }),
  getScanStats: async () => ({
    active: false
  })
}