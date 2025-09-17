// Placeholder for Flickr service - not implemented yet
export const flickrService = {
  getApiStatus: async () => ({
    isAuthenticated: false,
    rateLimits: { remaining: 0, resetTime: new Date() },
    tokenExpiresAt: null,
    lastRequest: null
  })
}