const { spawn } = require('child_process')

const testScript = `
console.log('Testing ContentFeed API call')

async function testFetch() {
  try {
    const url = 'http://localhost:3000/api/content?page=1&limit=6'
    console.log('Fetching:', url)
    
    const response = await fetch(url)
    console.log('Status:', response.status)
    console.log('OK:', response.ok)
    
    if (response.ok) {
      const data = await response.json()
      console.log('Success:', data.success)
      console.log('Content items:', data.data?.content?.length || 0)
      
      if (data.data?.content?.length > 0) {
        console.log('Sample item fields:', Object.keys(data.data.content[0]))
      }
    }
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testFetch()
`

const child = spawn('node', ['-e', testScript], {
  stdio: 'inherit',
  cwd: process.cwd()
})

child.on('close', (code) => {
  process.exit(code)
})