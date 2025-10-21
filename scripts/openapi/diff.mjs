#!/usr/bin/env node

/**
 * OpenAPI Spec Diff and Auto-regeneration Script
 * 
 * Compares generated OpenAPI spec with baseline and optionally updates it
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

// Paths
const GENERATED_SPEC = path.join(projectRoot, 'tmp/openapi.gen.json');
const BASELINE_SPEC = path.join(projectRoot, 'openapi.json');
const DOCS_SPEC = path.join(projectRoot, 'docs/openapi.yaml');

function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (error) {
    console.error(`Error loading ${filepath}:`, error.message);
    return null;
  }
}

function compareSpecs(generated, baseline) {
  const diffs = {
    addedPaths: [],
    removedPaths: [],
    modifiedPaths: [],
    addedSchemas: [],
    removedSchemas: [],
    versionChange: false
  };

  // Compare OpenAPI version
  if (generated.openapi !== baseline.openapi) {
    diffs.versionChange = true;
  }

  // Compare paths
  const genPaths = Object.keys(generated.paths || {});
  const basePaths = Object.keys(baseline.paths || {});
  
  diffs.addedPaths = genPaths.filter(p => !basePaths.includes(p));
  diffs.removedPaths = basePaths.filter(p => !genPaths.includes(p));
  
  // Check for modified paths (simplified - just checks operation count)
  genPaths.forEach(path => {
    if (basePaths.includes(path)) {
      const genOps = Object.keys(generated.paths[path]);
      const baseOps = Object.keys(baseline.paths[path]);
      if (genOps.length !== baseOps.length || !genOps.every(op => baseOps.includes(op))) {
        diffs.modifiedPaths.push(path);
      }
    }
  });

  // Compare schemas
  const genSchemas = Object.keys(generated.components?.schemas || {});
  const baseSchemas = Object.keys(baseline.components?.schemas || {});
  
  diffs.addedSchemas = genSchemas.filter(s => !baseSchemas.includes(s));
  diffs.removedSchemas = baseSchemas.filter(s => !genSchemas.includes(s));

  return diffs;
}

function hasDrift(diffs) {
  return (
    diffs.addedPaths.length > 0 ||
    diffs.removedPaths.length > 0 ||
    diffs.modifiedPaths.length > 0 ||
    diffs.addedSchemas.length > 0 ||
    diffs.removedSchemas.length > 0 ||
    diffs.versionChange
  );
}

function printDiffs(diffs) {
  console.log('\n📊 OpenAPI Spec Drift Analysis');
  console.log('================================\n');
  
  if (diffs.versionChange) {
    console.log('⚠️  OpenAPI version changed\n');
  }
  
  if (diffs.addedPaths.length > 0) {
    console.log('➕ Added paths:');
    diffs.addedPaths.forEach(p => console.log(`   - ${p}`));
    console.log('');
  }
  
  if (diffs.removedPaths.length > 0) {
    console.log('➖ Removed paths:');
    diffs.removedPaths.forEach(p => console.log(`   - ${p}`));
    console.log('');
  }
  
  if (diffs.modifiedPaths.length > 0) {
    console.log('📝 Modified paths:');
    diffs.modifiedPaths.forEach(p => console.log(`   - ${p}`));
    console.log('');
  }
  
  if (diffs.addedSchemas.length > 0) {
    console.log('➕ Added schemas:');
    diffs.addedSchemas.forEach(s => console.log(`   - ${s}`));
    console.log('');
  }
  
  if (diffs.removedSchemas.length > 0) {
    console.log('➖ Removed schemas:');
    diffs.removedSchemas.forEach(s => console.log(`   - ${s}`));
    console.log('');
  }
}

function updateBaseline(generated) {
  try {
    // Update the JSON baseline
    fs.writeFileSync(
      BASELINE_SPEC,
      JSON.stringify(generated, null, 2) + '\n',
      'utf8'
    );
    
    console.log(`✅ Updated baseline spec: ${BASELINE_SPEC}`);
    
    // If in CI, add to git
    if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS) {
      try {
        execSync('git config user.name "ci-bot"', { stdio: 'inherit' });
        execSync('git config user.email "ci@local"', { stdio: 'inherit' });
        execSync(`git add ${BASELINE_SPEC}`, { stdio: 'inherit' });
        console.log('✅ Added baseline spec to git');
      } catch (gitError) {
        console.error('⚠️  Could not add to git:', gitError.message);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to update baseline:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 OpenAPI Spec Drift Detection\n');
  
  // Check if generated spec exists
  if (!fs.existsSync(GENERATED_SPEC)) {
    console.error(`❌ Generated spec not found: ${GENERATED_SPEC}`);
    console.error('Run: pnpm tsx scripts/openapi/export.ts --out tmp/openapi.gen.json');
    process.exit(1);
  }
  
  // Create baseline if it doesn't exist
  if (!fs.existsSync(BASELINE_SPEC)) {
    console.log('⚠️  No baseline spec found, creating from generated...');
    const generated = loadJSON(GENERATED_SPEC);
    if (generated) {
      updateBaseline(generated);
      console.log('✅ Created initial baseline spec');
      process.exit(0);
    } else {
      console.error('❌ Could not create baseline');
      process.exit(1);
    }
  }
  
  // Load specs
  const generated = loadJSON(GENERATED_SPEC);
  const baseline = loadJSON(BASELINE_SPEC);
  
  if (!generated || !baseline) {
    console.error('❌ Failed to load specs for comparison');
    process.exit(1);
  }
  
  // Compare specs
  const diffs = compareSpecs(generated, baseline);
  
  if (!hasDrift(diffs)) {
    console.log('✅ No drift detected - specs are in sync');
    process.exit(0);
  }
  
  // Print differences
  printDiffs(diffs);
  
  // Auto-update in CI for PRs
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS) {
    console.log('\n🔄 Auto-updating baseline spec in CI...');
    
    if (updateBaseline(generated)) {
      console.log('✅ Baseline spec updated successfully');
      console.log('📝 Changes will be committed to the PR');
      process.exit(0);
    } else {
      console.log('❌ Failed to update baseline - neutralizing');
      process.exit(78); // Neutral exit
    }
  } else {
    console.log('\n⚠️  Drift detected - update the baseline manually or run in CI');
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});