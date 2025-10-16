'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Check, ExternalLink, RefreshCw } from 'lucide-react'

interface AuthExample {
  title: string
  description: string
  command: string
}

export default function AdminDocsPage() {
  const [authToken, setAuthToken] = useState<string>('')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [specContent, setSpecContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // Get auth token from localStorage or session
    const token = localStorage.getItem('adminToken') || ''
    setAuthToken(token)
    
    // Load the OpenAPI spec
    loadSpec(token)
  }, [])

  const loadSpec = async (token: string) => {
    if (!token) {
      setError('No authentication token found. Please log in first.')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError('')
      
      const response = await fetch('/api/admin/docs/openapi', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        throw new Error(`Failed to load OpenAPI spec: ${response.status}`)
      }

      const yamlContent = await response.text()
      setSpecContent(yamlContent)
    } catch (err) {
      console.error('Error loading spec:', err)
      setError(err instanceof Error ? err.message : 'Failed to load API specification')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const authExamples: AuthExample[] = [
    {
      title: 'Bearer Token (Recommended)',
      description: 'Standard Authorization header with Bearer token',
      command: `curl -H "Authorization: Bearer ${authToken || '<your-token>'}" \\\n  https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=2023-10-15`
    },
    {
      title: 'Custom Header',
      description: 'Alternative using x-admin-token header',
      command: `curl -H "x-admin-token: ${authToken || '<your-token>'}" \\\n  https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=2023-10-15`
    },
    {
      title: 'POST Request Example',
      description: 'Refill schedule with JSON body',
      command: `curl -X POST \\\n  -H "Authorization: Bearer ${authToken || '<your-token>'}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"date":"2023-10-15","mode":"create-or-reuse","twoDays":true}' \\\n  https://hotdog-diaries.vercel.app/api/admin/schedule/forecast/refill`
    }
  ]

  const refreshSpec = () => {
    loadSpec(authToken)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading API documentation...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">API Documentation</h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800">{error}</p>
            </div>
            <Button onClick={refreshSpec} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">API Documentation</h1>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">OpenAPI 3.1</Badge>
            <Button variant="outline" size="sm" onClick={refreshSpec}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
        
        <p className="text-gray-600 mb-6">
          Interactive documentation for the Hotdog Diaries API. All admin endpoints require authentication.
        </p>

        {/* Authentication Examples */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            🔐 Authentication Examples
          </h2>
          
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
            {authExamples.map((example, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{example.title}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(example.command, index)}
                    className="ml-2"
                  >
                    {copiedIndex === index ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mb-3">{example.description}</p>
                <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                  <code>{example.command}</code>
                </pre>
              </div>
            ))}
          </div>

          {!authToken && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                💡 <strong>Tip:</strong> Your authentication token will be automatically filled in the examples once you're logged in.
              </p>
            </div>
          )}
        </Card>

        {/* Quick Links */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🔗 Quick Links</h2>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            <a
              href="#operation/getForecast"
              className="flex items-center p-3 border rounded hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium">Get Schedule Forecast</span>
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
            <a
              href="#operation/refillSchedule"
              className="flex items-center p-3 border rounded hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium">Refill Schedule</span>
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
            <a
              href="#operation/getDeepHealth"
              className="flex items-center p-3 border rounded hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium">Deep Health Check</span>
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
            <a
              href="#operation/getSystemMetrics"
              className="flex items-center p-3 border rounded hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium">System Metrics</span>
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
            <a
              href="#operation/validateAuthToken"
              className="flex items-center p-3 border rounded hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium">Validate Token</span>
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
            <a
              href="#operation/reconcileSchedule"
              className="flex items-center p-3 border rounded hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium">Reconcile Schedule</span>
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
          </div>
        </Card>
      </div>

      {/* Redoc Container */}
      <Card className="overflow-hidden">
        <div id="redoc-container" className="min-h-screen">
          {specContent && (
            <RedocViewer specContent={specContent} authToken={authToken} />
          )}
        </div>
      </Card>
    </div>
  )
}

// Redoc Viewer Component
function RedocViewer({ specContent, authToken }: { specContent: string; authToken: string }) {
  useEffect(() => {
    // Import Redoc dynamically to avoid SSR issues
    import('redoc').then(({ Redoc }) => {
      const container = document.getElementById('redoc-container')
      if (container && specContent) {
        container.innerHTML = '' // Clear existing content
        
        try {
          // Parse YAML to JSON for Redoc
          import('js-yaml').then(({ load }) => {
            const spec = load(specContent)
            
            // Initialize Redoc
            Redoc.init(spec, {
              theme: {
                colors: {
                  primary: {
                    main: '#2563eb'
                  }
                },
                typography: {
                  fontSize: '14px',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                }
              },
              scrollYOffset: 60,
              hideDownloadButton: false,
              hideHostname: false,
              expandResponses: '200',
              menuToggle: true,
              pathInMiddlePanel: true,
              requiredPropsFirst: true,
              sortPropsAlphabetically: false,
              showExtensions: true,
              nativeScrollbars: true
            }, container)
          }).catch(error => {
            console.error('Failed to parse YAML:', error)
            container.innerHTML = `
              <div class="p-6 text-center">
                <p class="text-red-600">Failed to parse OpenAPI specification.</p>
                <p class="text-sm text-gray-600 mt-2">Please check the YAML syntax.</p>
              </div>
            `
          })
        } catch (error) {
          console.error('Failed to initialize Redoc:', error)
          container.innerHTML = `
            <div class="p-6 text-center">
              <p class="text-red-600">Failed to load API documentation.</p>
              <p class="text-sm text-gray-600 mt-2">Please refresh the page and try again.</p>
            </div>
          `
        }
      }
    }).catch(error => {
      console.error('Failed to load Redoc:', error)
      const container = document.getElementById('redoc-container')
      if (container) {
        container.innerHTML = `
          <div class="p-6 text-center">
            <p class="text-red-600">Failed to load documentation viewer.</p>
            <p class="text-sm text-gray-600 mt-2">Please check your internet connection and refresh.</p>
          </div>
        `
      }
    })
  }, [specContent, authToken])

  return <div>Loading interactive documentation...</div>
}