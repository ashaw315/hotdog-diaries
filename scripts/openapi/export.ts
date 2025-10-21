#!/usr/bin/env tsx

/**
 * OpenAPI Spec Export Script
 * 
 * Generates OpenAPI specification from the current codebase
 */

import fs from 'fs';
import path from 'path';

// Parse CLI arguments manually
const args = process.argv.slice(2);
const options = {
  out: 'openapi.json',
  format: 'json'
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out' && args[i + 1]) {
    options.out = args[++i];
  } else if (args[i] === '--format' && args[i + 1]) {
    options.format = args[++i];
  }
}

// Basic OpenAPI spec structure
const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Hotdog Diaries API',
    version: '1.0.0',
    description: 'API for the Hotdog Diaries social media content aggregator'
  },
  servers: [
    {
      url: 'https://hotdog-diaries.vercel.app/api',
      description: 'Production'
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Development'
    }
  ],
  paths: {},
  components: {
    securitySchemes: {
      AdminToken: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Admin JWT token for protected endpoints'
      }
    },
    schemas: {}
  }
};

// Read API inventory if it exists
const inventoryPath = path.join(process.cwd(), 'docs/api-inventory.json');
if (fs.existsSync(inventoryPath)) {
  try {
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    
    // Convert inventory routes to OpenAPI paths
    inventory.routes.forEach(route => {
      // Remove /api prefix for OpenAPI spec
      const pathKey = route.path.replace(/^\/api/, '') || '/';
      
      if (!spec.paths[pathKey]) {
        spec.paths[pathKey] = {};
      }
      
      // Determine HTTP method (simplified - would need actual route analysis)
      const method = route.method?.toLowerCase() || 'get';
      
      spec.paths[pathKey][method] = {
        summary: route.description || `${method.toUpperCase()} ${pathKey}`,
        operationId: route.operationId || `${method}${pathKey.replace(/[^a-zA-Z0-9]/g, '')}`,
        tags: route.tags || [route.category || 'default'],
        responses: {
          '200': {
            description: 'Success'
          }
        }
      };
      
      // Add security for admin routes
      if (route.category === 'admin' || route.path.includes('/admin/')) {
        spec.paths[pathKey][method].security = [{ AdminToken: [] }];
      }
    });
  } catch (error) {
    console.error('Warning: Could not read API inventory:', error.message);
  }
}

// Write output
try {
  const outputPath = path.resolve(options.out);
  
  if (options.format === 'yaml') {
    // Would need a YAML library for this
    console.error('YAML output not yet implemented');
    process.exit(1);
  } else {
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2) + '\n', 'utf8');
  }
  
  console.log(`✅ OpenAPI spec exported to: ${outputPath}`);
  console.log(`📊 Stats: ${Object.keys(spec.paths).length} paths, ${Object.keys(spec.components.schemas).length} schemas`);
  
} catch (error) {
  console.error('❌ Failed to write output:', error.message);
  process.exit(1);
}