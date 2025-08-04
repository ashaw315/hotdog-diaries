const { exec } = require('child_process');

// Test content processing by calling the API directly
async function testContentProcessing() {
  try {
    console.log('Testing ContentProcessor through Next.js API...');
    
    // We'll create a simple API test by making a curl request to process content
    const curl = `curl -X POST http://localhost:3000/api/test-content-processor -H "Content-Type: application/json" -d '{"contentId": 2}'`;
    
    console.log('Executing:', curl);
    
    exec(curl, (error, stdout, stderr) => {
      if (error) {
        console.error('Error:', error);
        return;
      }
      if (stderr) {
        console.error('Stderr:', stderr);
      }
      console.log('Response:', stdout);
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testContentProcessing();