/**
 * Tests for strict production database requirements
 * This file tests the DatabaseConnection class directly without mocking
 */

describe('Database Connection - Production Requirements', () => {
  const originalEnv = process.env;
  let mockConsoleLog: jest.Mock;
  let mockConsoleError: jest.Mock;

  beforeEach(() => {
    // Mock console methods
    mockConsoleLog = jest.fn();
    mockConsoleError = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(mockConsoleLog);
    jest.spyOn(console, 'error').mockImplementation(mockConsoleError);
    
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.VERCEL_ENV;
    
    // Clear module cache
    jest.clearAllMocks();
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Production Environment Tests', () => {
    it('should require DATABASE_URL in production', async () => {
      process.env.NODE_ENV = 'production';
      
      // Import the module which should trigger the constructor
      await expect(async () => {
        // Dynamic import to ensure fresh module loading
        const { DatabaseConnection } = await import('@/lib/db');
      }).rejects.toThrow();
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('FATAL ERROR: DATABASE_URL not set in production')
      );
    });

    it('should require Supabase URL in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/dbname';
      
      await expect(async () => {
        const { DatabaseConnection } = await import('@/lib/db');
      }).rejects.toThrow();
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('DATABASE_URL in production must be a Supabase connection string')
      );
    });

    it('should accept valid Supabase URL in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:password@db.xxxx.supabase.co:5432/postgres';
      
      await expect(async () => {
        const { DatabaseConnection } = await import('@/lib/db');
      }).resolves.not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Using Supabase Postgres via DATABASE_URL')
      );
    });
  });

  describe('Development Environment Tests', () => {
    it('should allow SQLite fallback in development', async () => {
      process.env.NODE_ENV = 'development';
      // No DATABASE_URL set
      
      await expect(async () => {
        const { DatabaseConnection } = await import('@/lib/db');
      }).resolves.not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Using SQLite (development fallback)')
      );
    });

    it('should use Supabase when DATABASE_URL is provided in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:password@db.xxxx.supabase.co:5432/postgres';
      
      await expect(async () => {
        const { DatabaseConnection } = await import('@/lib/db');
      }).resolves.not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Using Supabase Postgres via DATABASE_URL (development)')
      );
    });
  });

  describe('Preview Environment Tests', () => {
    it('should allow SQLite fallback in preview', async () => {
      process.env.NODE_ENV = 'production'; // Vercel sets this even for preview
      process.env.VERCEL_ENV = 'preview';
      // No DATABASE_URL set
      
      await expect(async () => {
        const { DatabaseConnection } = await import('@/lib/db');
      }).resolves.not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Using SQLite (preview fallback)')
      );
    });

    it('should use Supabase when DATABASE_URL is provided in preview', async () => {
      process.env.NODE_ENV = 'production';
      process.env.VERCEL_ENV = 'preview';
      process.env.DATABASE_URL = 'postgresql://user:password@db.xxxx.supabase.co:5432/postgres';
      
      await expect(async () => {
        const { DatabaseConnection } = await import('@/lib/db');
      }).resolves.not.toThrow();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Using Supabase Postgres via DATABASE_URL (preview)')
      );
    });
  });

  describe('Environment Variable Detection', () => {
    it('should correctly detect Supabase URLs', async () => {
      const supabaseUrls = [
        'postgresql://user:password@db.xxxx.supabase.co:5432/postgres',
        'postgres://user:password@db.yyyy.supabase.co:5432/postgres?sslmode=require',
      ];

      for (const url of supabaseUrls) {
        // Reset for each iteration
        jest.resetModules();
        process.env.NODE_ENV = 'production';
        process.env.DATABASE_URL = url;
        
        await expect(async () => {
          const { DatabaseConnection } = await import('@/lib/db');
        }).resolves.not.toThrow();
      }
    });

    it('should correctly reject non-Supabase URLs in production', async () => {
      const nonSupabaseUrls = [
        'postgresql://user:password@localhost:5432/dbname',
        'postgres://user:password@aws-rds.amazonaws.com:5432/dbname',
        'postgresql://user:password@vercel-postgres.com:5432/dbname',
      ];

      for (const url of nonSupabaseUrls) {
        // Reset for each iteration
        jest.resetModules();
        mockConsoleError.mockClear();
        process.env.NODE_ENV = 'production';
        process.env.DATABASE_URL = url;
        
        await expect(async () => {
          const { DatabaseConnection } = await import('@/lib/db');
        }).rejects.toThrow();
        
        expect(mockConsoleError).toHaveBeenCalledWith(
          expect.stringContaining('DATABASE_URL in production must be a Supabase connection string')
        );
      }
    });
  });
});