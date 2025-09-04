// Simple test script to understand E2B v2 API
import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'

async function testE2B() {
  try {
    console.log('Testing E2B v2 API...')
    console.log('API Key:', process.env.E2B_API_KEY ? 'configured' : 'missing')
    
    // Create sandbox
    console.log('Creating sandbox...')
    const sandbox = await Sandbox.create()
    
    console.log('Sandbox created successfully!')
    console.log('Sandbox object keys:', Object.keys(sandbox))
    console.log('Sandbox type:', typeof sandbox)
    
    // Test basic code execution
    console.log('Running test code...')
    const result = await sandbox.runCode('print("Hello from E2B!")')
    
    console.log('Execution result keys:', Object.keys(result))
    console.log('Logs type:', typeof result.logs)
    console.log('Logs:', result.logs)
    
    // Test file operations
    console.log('Testing file operations...')
    await sandbox.files.write('/test.txt', 'Hello World!')
    const files = await sandbox.files.list('/')
    console.log('Files:', files)
    
    // Cleanup
    await sandbox.close()
    console.log('Test completed successfully!')
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testE2B()