import '@testing-library/jest-dom'

// Mock NextJS modules that cause issues in Jest
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url, options = {}) => ({
    method: options.method || 'GET',
    url,
    headers: new Map(Object.entries(options.headers || {})),
    json: async () => options.body ? JSON.parse(options.body) : {}
  })),
  NextResponse: {
    json: jest.fn((data, options = {}) => ({
      json: async () => data,
      status: options.status || 200
    }))
  }
}))

// Mock Web APIs for Next.js route handlers
global.Request = class MockRequest {
  constructor(url, options = {}) {
    Object.defineProperty(this, 'url', { value: url, writable: false })
    this.method = options.method || 'GET'
    this.headers = new Map(Object.entries(options.headers || {}))
    this.body = options.body
  }

  async json() {
    return this.body ? JSON.parse(this.body) : {}
  }
}

global.Response = class MockResponse {
  constructor(body, options = {}) {
    this.body = body
    this.status = options.status || 200
    this.headers = new Map(Object.entries(options.headers || {}))
  }

  static json(data, options = {}) {
    return new MockResponse(JSON.stringify(data), {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    })
  }

  async json() {
    return this.body ? JSON.parse(this.body) : {}
  }
}