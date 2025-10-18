#!/usr/bin/env node

/**
 * Markdown to PDF Converter
 * 
 * Converts docs/runbook.md to docs/runbook.pdf using Puppeteer
 * for high-quality PDF generation with proper styling and links.
 */

import fs from 'fs'
import path from 'path'
import { marked } from 'marked'
import puppeteer from 'puppeteer'

interface ConversionOptions {
  inputFile?: string
  outputFile?: string
  format?: 'A4' | 'Letter'
  margin?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }
  displayHeaderFooter?: boolean
  headerTemplate?: string
  footerTemplate?: string
}

const DEFAULT_OPTIONS: Required<ConversionOptions> = {
  inputFile: 'docs/runbook.md',
  outputFile: 'docs/runbook.pdf',
  format: 'A4',
  margin: {
    top: '1in',
    right: '0.8in',
    bottom: '1in',
    left: '0.8in'
  },
  displayHeaderFooter: true,
  headerTemplate: `
    <div style="width: 100%; font-size: 10px; padding: 5px; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between;">
      <span>Hotdog Diaries SRE Runbook</span>
      <span>Generated: ${new Date().toISOString().split('T')[0]}</span>
    </div>
  `,
  footerTemplate: `
    <div style="width: 100%; font-size: 10px; padding: 5px; border-top: 1px solid #ccc; text-align: center;">
      <span class="pageNumber"></span> / <span class="totalPages"></span>
    </div>
  `
}

const CSS_STYLES = `
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: none;
    margin: 0;
    padding: 20px;
  }
  
  h1 {
    color: #2c3e50;
    border-bottom: 3px solid #3498db;
    padding-bottom: 10px;
    page-break-before: always;
  }
  
  h1:first-of-type {
    page-break-before: auto;
  }
  
  h2 {
    color: #34495e;
    border-bottom: 2px solid #ecf0f1;
    padding-bottom: 5px;
    margin-top: 30px;
    page-break-before: avoid;
    page-break-after: avoid;
  }
  
  h3 {
    color: #5d6d7e;
    margin-top: 25px;
    page-break-after: avoid;
  }
  
  h4, h5, h6 {
    color: #85929e;
    page-break-after: avoid;
  }
  
  code {
    background-color: #f8f9fa;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 0.9em;
  }
  
  pre {
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 5px;
    padding: 15px;
    overflow-x: auto;
    page-break-inside: avoid;
    margin: 10px 0;
  }
  
  pre code {
    background: none;
    padding: 0;
    border-radius: 0;
  }
  
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 15px 0;
    page-break-inside: avoid;
  }
  
  th, td {
    border: 1px solid #ddd;
    padding: 8px 12px;
    text-align: left;
  }
  
  th {
    background-color: #f8f9fa;
    font-weight: 600;
  }
  
  tr:nth-child(even) {
    background-color: #f8f9fa;
  }
  
  blockquote {
    border-left: 4px solid #3498db;
    margin: 15px 0;
    padding: 10px 20px;
    background-color: #f8f9fa;
    page-break-inside: avoid;
  }
  
  ul, ol {
    padding-left: 20px;
  }
  
  li {
    margin: 5px 0;
    page-break-inside: avoid;
  }
  
  a {
    color: #3498db;
    text-decoration: none;
  }
  
  a:hover {
    text-decoration: underline;
  }
  
  .page-break {
    page-break-before: always;
  }
  
  .no-break {
    page-break-inside: avoid;
  }
  
  /* Table of Contents styling */
  .toc {
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
    padding: 20px;
    margin: 20px 0;
    page-break-inside: avoid;
  }
  
  .toc h2 {
    margin-top: 0;
    border-bottom: none;
  }
  
  .toc ul {
    list-style-type: none;
    padding-left: 0;
  }
  
  .toc li {
    margin: 8px 0;
    padding-left: 20px;
  }
  
  .toc a {
    font-weight: 500;
  }

  /* Command line styling */
  .language-bash,
  .language-shell {
    background-color: #2d3748 !important;
    color: #e2e8f0 !important;
  }
  
  .language-bash code,
  .language-shell code {
    color: #e2e8f0 !important;
    background: none !important;
  }
  
  /* Print-specific styles */
  @media print {
    body {
      font-size: 11px;
    }
    
    h1 {
      font-size: 20px;
    }
    
    h2 {
      font-size: 16px;
    }
    
    h3 {
      font-size: 14px;
    }
    
    pre, code {
      font-size: 9px;
    }
  }
</style>
`

async function convertMarkdownToPDF(options: ConversionOptions = {}): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  console.log('🔄 Converting Markdown to PDF...')
  console.log(`📄 Input: ${opts.inputFile}`)
  console.log(`📋 Output: ${opts.outputFile}`)
  
  try {
    // Read markdown file
    const markdownPath = path.resolve(opts.inputFile)
    if (!fs.existsSync(markdownPath)) {
      throw new Error(`Markdown file not found: ${markdownPath}`)
    }
    
    const markdownContent = fs.readFileSync(markdownPath, 'utf-8')
    console.log(`✅ Read markdown file (${markdownContent.length} characters)`)
    
    // Configure marked with options for better PDF output
    marked.setOptions({
      gfm: true,
      breaks: false,
      pedantic: false,
      sanitize: false,
      smartypants: true
    })
    
    // Convert markdown to HTML
    const htmlContent = marked(markdownContent)
    
    // Create complete HTML document
    const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hotdog Diaries SRE Runbook</title>
  ${CSS_STYLES}
</head>
<body>
  ${htmlContent}
</body>
</html>
    `.trim()
    
    console.log('✅ Converted Markdown to HTML')
    
    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    console.log('✅ Launched Puppeteer browser')
    
    try {
      const page = await browser.newPage()
      
      // Set content and wait for network to be idle
      await page.setContent(fullHtml, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      })
      
      console.log('✅ Loaded content in browser')
      
      // Generate PDF
      const outputPath = path.resolve(opts.outputFile)
      const outputDir = path.dirname(outputPath)
      
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
        console.log(`✅ Created output directory: ${outputDir}`)
      }
      
      await page.pdf({
        path: outputPath,
        format: opts.format,
        margin: opts.margin,
        displayHeaderFooter: opts.displayHeaderFooter,
        headerTemplate: opts.headerTemplate,
        footerTemplate: opts.footerTemplate,
        printBackground: true,
        preferCSSPageSize: false,
        timeout: 60000
      })
      
      console.log('✅ Generated PDF successfully')
      
      // Get file size for confirmation
      const stats = fs.statSync(outputPath)
      const fileSizeKB = Math.round(stats.size / 1024)
      
      console.log('')
      console.log('📋 PDF Generation Complete!')
      console.log(`📍 Location: ${outputPath}`)
      console.log(`📏 Size: ${fileSizeKB} KB`)
      console.log(`📄 Format: ${opts.format}`)
      console.log('')
      
    } finally {
      await browser.close()
      console.log('✅ Closed browser')
    }
    
  } catch (error) {
    console.error('❌ PDF generation failed:', error)
    process.exit(1)
  }
}

// CLI argument parsing
function parseArgs(): ConversionOptions {
  const args = process.argv.slice(2)
  const options: ConversionOptions = {}
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]
    
    switch (arg) {
      case '--input':
      case '-i':
        if (nextArg && !nextArg.startsWith('--')) {
          options.inputFile = nextArg
          i++
        }
        break
        
      case '--output':
      case '-o':
        if (nextArg && !nextArg.startsWith('--')) {
          options.outputFile = nextArg
          i++
        }
        break
        
      case '--format':
      case '-f':
        if (nextArg && (nextArg === 'A4' || nextArg === 'Letter')) {
          options.format = nextArg as 'A4' | 'Letter'
          i++
        }
        break
        
      case '--help':
      case '-h':
        console.log(`
Markdown to PDF Converter

Usage: npx tsx scripts/md-to-pdf.ts [options]

Options:
  -i, --input <file>     Input markdown file (default: docs/runbook.md)
  -o, --output <file>    Output PDF file (default: docs/runbook.pdf)
  -f, --format <format>  Page format: A4 or Letter (default: A4)
  -h, --help            Show this help message

Examples:
  npx tsx scripts/md-to-pdf.ts
  npx tsx scripts/md-to-pdf.ts --input docs/api.md --output docs/api.pdf
  npx tsx scripts/md-to-pdf.ts --format Letter
        `)
        process.exit(0)
        break
    }
  }
  
  return options
}

// Main execution
if (require.main === module) {
  const options = parseArgs()
  convertMarkdownToPDF(options).catch(error => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
}

export { convertMarkdownToPDF, ConversionOptions }