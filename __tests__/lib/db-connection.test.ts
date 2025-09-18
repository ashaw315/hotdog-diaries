/**
 * Comprehensive tests for database connection logic
 * Tests the strict production requirements and environment-based connection selection
 */

// Mock console methods to capture logging output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let mockConsoleLog: jest.Mock;
let mockConsoleError: jest.Mock;

// Clear all mocks and reset environment before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockConsoleLog = jest.fn();
  mockConsoleError = jest.fn();
  console.log = mockConsoleLog;
  console.error = mockConsoleError;
  
  // Clear all environment variables
  delete process.env.NODE_ENV;
  delete process.env.VERCEL_ENV;
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_HOST;
  delete process.env.DATABASE_PORT;
  delete process.env.DATABASE_NAME;
  delete process.env.DATABASE_USER;
  delete process.env.DATABASE_PASSWORD;
  delete process.env.USE_POSTGRES_IN_DEV;
  
  // Reset module cache to ensure fresh imports
  jest.resetModules();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('Database Connection Logic', () => {
  describe('Production Environment - Strict Requirements', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should throw error when DATABASE_URL is missing in production', () => {
      expect(() => {
        // Re-import to trigger constructor with new env vars
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).toThrow('DATABASE_URL is required in production environment');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        '🚨 FATAL ERROR: DATABASE_URL not set in production — Supabase connection required.'
      );
    });

    it('should throw error when DATABASE_URL is not a Supabase URL in production', () => {
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/dbname';
      
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).toThrow('DATABASE_URL must be a Supabase connection string in production');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        '🚨 FATAL ERROR: DATABASE_URL in production must be a Supabase connection string.'
      );
    });

    it('should succeed with valid Supabase URL in production', () => {
      process.env.DATABASE_URL = 'postgresql://user:password@db.xxxx.supabase.co:5432/postgres';
      
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ [DB INIT] Using Supabase Postgres via DATABASE_URL'
      );
    });

    it('should not fall back to POSTGRES_URL in production', () => {
      process.env.POSTGRES_URL = 'postgresql://vercel-user:password@localhost:5432/vercel-db';
      
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).toThrow('DATABASE_URL is required in production environment');
    });
  });

  describe('Development Environment - Flexible Requirements', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should use Supabase when DATABASE_URL is provided in development', () => {
      process.env.DATABASE_URL = 'postgresql://user:password@db.xxxx.supabase.co:5432/postgres';
      
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ [DB INIT] Using Supabase Postgres via DATABASE_URL (development)'
      );
    });

    it('should fall back to SQLite when DATABASE_URL is missing in development', () => {
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ [DB INIT] Using SQLite (development fallback)'
      );
    });

    it('should not use POSTGRES_URL in development (prefers SQLite fallback)', () => {
      process.env.POSTGRES_URL = 'postgresql://vercel-user:password@localhost:5432/vercel-db';
      
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ [DB INIT] Using SQLite (development fallback)'
      );
    });
  });

  describe('Preview Environment - Hybrid Requirements', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'; // Vercel sets this
      process.env.VERCEL_ENV = 'preview';
    });

    it('should use Supabase when DATABASE_URL is provided in preview', () => {
      process.env.DATABASE_URL = 'postgresql://user:password@db.xxxx.supabase.co:5432/postgres';
      
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ [DB INIT] Using Supabase Postgres via DATABASE_URL (preview)'
      );
    });

    it('should fall back to SQLite when DATABASE_URL is missing in preview', () => {
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ [DB INIT] Using SQLite (preview fallback)'
      );
    });

    it('should not fail in preview without DATABASE_URL (unlike production)', () => {
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).not.toThrow();
    });
  });

  describe('Other Environments - Fallback Logic', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should use Supabase when DATABASE_URL is provided in test environment', () => {
      process.env.DATABASE_URL = 'postgresql://user:password@db.xxxx.supabase.co:5432/postgres';
      
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ [DB INIT] Using Supabase Postgres via DATABASE_URL (other environment)'
      );
    });

    it('should use PostgreSQL pool when no DATABASE_URL in test environment', () => {
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ [DB INIT] Using PostgreSQL connection pool (other environment)'
      );
    });
  });

  describe('Logging and Environment Detection', () => {
    it('should log comprehensive environment information', () => {
      process.env.NODE_ENV = 'production';
      process.env.VERCEL_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:password@db.xxxx.supabase.co:5432/postgres';
      
      delete require.cache[require.resolve('@/lib/db')];
      require('@/lib/db');
      
      expect(mockConsoleLog).toHaveBeenCalledWith('🚀 [DB INIT] Starting database initialization...');
      expect(mockConsoleLog).toHaveBeenCalledWith('[DB INIT] Environment detection:', {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        DATABASE_URL_SET: true,
        DATABASE_URL_TYPE: 'supabase',
        isProduction: true,
        isPreview: false,
        isDevelopment: false
      });
    });

    it('should detect different DATABASE_URL types correctly', () => {
      const testCases = [
        {
          url: 'postgresql://user:password@db.xxxx.supabase.co:5432/postgres',
          expectedType: 'supabase'
        },
        {
          url: 'postgresql://user:password@localhost:5432/dbname',
          expectedType: 'postgres'
        },
        {
          url: undefined,
          expectedType: 'missing'
        }
      ];

      testCases.forEach(({ url, expectedType }) => {
        // Reset for each test case
        jest.resetModules();
        mockConsoleLog.mockClear();
        
        process.env.NODE_ENV = 'development';
        if (url) {
          process.env.DATABASE_URL = url;
        } else {
          delete process.env.DATABASE_URL;
        }
        
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
        
        expect(mockConsoleLog).toHaveBeenCalledWith('[DB INIT] Environment detection:', 
          expect.objectContaining({
            DATABASE_URL_TYPE: expectedType
          })
        );
      });
    });
  });

  describe('Configuration Parsing', () => {
    it('should correctly parse Supabase DATABASE_URL', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://postgres.user:password123@db.xxxx.supabase.co:5432/postgres';
      
      // This test verifies that the constructor doesn't throw
      // The actual connection config parsing would be tested in integration tests
      expect(() => {
        delete require.cache[require.resolve('@/lib/db')];
        require('@/lib/db');
      }).not.toThrow();
    });
  });
});