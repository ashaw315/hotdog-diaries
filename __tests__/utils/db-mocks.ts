/**
 * Shared database mocks for Prisma + query builder tests
 * Centralizes all DB-related mocking to ensure consistency across test suites
 */

// Mock Prisma query results
export function mockPrismaQuery(result: any) {
  return jest.fn().mockResolvedValue(result);
}

// Mock database transactions
export function mockDbTransaction(result: any) {
  return jest.fn().mockImplementation(async (cb) => cb(result));
}

// Mock standard content row structure
export const mockContentRow = {
  id: "uuid-123-content",
  content_text: "Test hotdog content",
  content_type: "text",
  source_platform: "reddit",
  original_url: "https://reddit.com/r/hotdogs/test",
  original_author: "testuser",
  content_image_url: null,
  content_video_url: null,
  content_hash: "test_hash_123",
  is_approved: true,
  is_posted: false,
  is_rejected: false,
  confidence_score: 0.8,
  admin_notes: null,
  scraped_at: new Date("2024-01-01T10:00:00Z"),
  created_at: new Date("2024-01-01T10:00:00Z"),
  updated_at: new Date("2024-01-01T10:00:00Z")
};

// Mock admin user row structure
export const mockAdminUserRow = {
  id: "uuid-456-admin",
  username: "admin",
  email: "admin@hotdogdiaries.com",
  password_hash: "$2b$10$hashedpassword",
  full_name: "Administrator",
  is_active: true,
  last_login_at: new Date("2024-01-01T09:00:00Z"),
  created_at: new Date("2024-01-01T08:00:00Z"),
  updated_at: new Date("2024-01-01T09:00:00Z")
};

// Mock system log row structure
export const mockSystemLogRow = {
  id: "uuid-789-log",
  level: "INFO",
  message: "Test log message",
  context: { test: true },
  user_id: null,
  created_at: new Date("2024-01-01T10:30:00Z")
};

// Mock posted content row structure
export const mockPostedContentRow = {
  id: "uuid-101-posted",
  content_queue_id: "uuid-123-content",
  posted_at: new Date("2024-01-01T12:00:00Z"),
  scheduled_time: null,
  post_order: 1,
  created_at: new Date("2024-01-01T12:00:00Z")
};

// Standard database response structures
export const mockDbResponses = {
  // Single row query result
  singleRow: (row: any) => ({ rows: [row], rowCount: 1 }),
  
  // Multiple rows query result
  multipleRows: (rows: any[]) => ({ rows, rowCount: rows.length }),
  
  // Empty query result
  empty: () => ({ rows: [], rowCount: 0 }),
  
  // Count query result
  count: (count: number) => ({ rows: [{ count: count.toString() }], rowCount: 1 }),
  
  // Insert/Update/Delete result
  mutation: (rowCount: number = 1) => ({ rowCount, command: 'INSERT' })
};

// Mock database connection
export function mockDbConnection() {
  return {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    healthCheck: jest.fn().mockResolvedValue({ connected: true, latency: 10 })
  };
}

// Mock Prisma client
export function mockPrismaClient() {
  return {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    contentQueue: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    adminUsers: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    systemLogs: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn()
    },
    postedContent: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn()
    }
  };
}

// Helper to convert snake_case DB fields to camelCase Prisma fields
export function toPrismaFormat(dbRow: any) {
  const prismaRow: any = {};
  
  for (const [key, value] of Object.entries(dbRow)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    prismaRow[camelKey] = value;
  }
  
  return prismaRow;
}

// Helper to convert camelCase Prisma fields to snake_case DB fields
export function toDbFormat(prismaRow: any) {
  const dbRow: any = {};
  
  for (const [key, value] of Object.entries(prismaRow)) {
    // Convert camelCase to snake_case
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    dbRow[snakeKey] = value;
  }
  
  return dbRow;
}

// Mock database error scenarios
export const mockDbErrors = {
  connectionFailed: new Error('Database connection failed'),
  queryTimeout: new Error('Query timeout'),
  constraintViolation: new Error('UNIQUE constraint failed'),
  invalidUuid: new Error('Invalid UUID format'),
  foreignKeyError: new Error('Foreign key constraint failed')
};

// Standard test data sets
export const testDataSets = {
  // Multiple content items with different statuses
  contentQueue: [
    { ...mockContentRow, id: "content-1", content_text: "First hotdog", is_approved: true, is_posted: false },
    { ...mockContentRow, id: "content-2", content_text: "Second hotdog", is_approved: false, is_posted: false },
    { ...mockContentRow, id: "content-3", content_text: "Third hotdog", is_approved: true, is_posted: true }
  ],
  
  // Multiple admin users
  adminUsers: [
    { ...mockAdminUserRow, id: "admin-1", username: "admin", is_active: true },
    { ...mockAdminUserRow, id: "admin-2", username: "moderator", is_active: true },
    { ...mockAdminUserRow, id: "admin-3", username: "inactive", is_active: false }
  ],
  
  // System logs with different levels
  systemLogs: [
    { ...mockSystemLogRow, id: "log-1", level: "INFO", message: "System started" },
    { ...mockSystemLogRow, id: "log-2", level: "WARN", message: "High memory usage" },
    { ...mockSystemLogRow, id: "log-3", level: "ERROR", message: "Database error" }
  ]
};

export default {
  mockPrismaQuery,
  mockDbTransaction,
  mockContentRow,
  mockAdminUserRow,
  mockSystemLogRow,
  mockPostedContentRow,
  mockDbResponses,
  mockDbConnection,
  mockPrismaClient,
  toPrismaFormat,
  toDbFormat,
  mockDbErrors,
  testDataSets
};