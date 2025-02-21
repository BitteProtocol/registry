import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// List of paths that should allow CORS for GET requests
const PUBLIC_GET_PATHS = [
  '/api/agents',
  '/api/tools',
]

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname

  // Check if this is a GET request to a public path
  const isPublicGetPath = PUBLIC_GET_PATHS.some(publicPath => 
    path.startsWith(publicPath)
  )
  const isGetRequest = request.method === 'GET'

  // If this is a GET request to a public path, add CORS headers
  if (isPublicGetPath && isGetRequest) {
    const response = NextResponse.next()
    
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
    
    return response
  }

  // For all other requests, proceed normally without CORS headers
  return NextResponse.next()
}

// Configure the middleware to run only on API routes
export const config = {
  matcher: '/api/:path*',
} 