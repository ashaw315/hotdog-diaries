const { ContentProcessor } = require('./lib/services/content-processor')
const { db } = require('./lib/db')

async function testContentProcessor() {
  try {
    console.log('Testing ContentProcessor...')
    
    // Get content from database
    const content = await db.query('SELECT * FROM content_queue WHERE id = 1')
    
    if (content.rows.length === 0) {
      console.log('No content found with ID 1')
      return
    }
    
    console.log('Content found:', content.rows[0])
    
    // Test ContentProcessor
    const processor = new ContentProcessor()
    console.log('Processing content...')
    
    const result = await processor.processContent(1)
    console.log('Processing result:', JSON.stringify(result, null, 2))
    
  } catch (error) {
    console.error('Error testing ContentProcessor:', error)
  } finally {
    process.exit(0)
  }
}

testContentProcessor()