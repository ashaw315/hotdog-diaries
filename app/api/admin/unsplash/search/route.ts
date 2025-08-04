import { NextRequest, NextResponse } from 'next/server'
import { unsplashService } from '@/lib/services/unsplash'

export async function POST(request: NextRequest) {
  try {
    const { query: searchQuery, maxResults = 20, orientation = 'landscape', orderBy = 'relevant' } = await request.json()
    
    if (!searchQuery || typeof searchQuery !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Search query is required'
        },
        { status: 400 }
      )
    }
    
    const searchOptions = {
      query: searchQuery,
      maxResults: Math.min(maxResults, 30),
      orientation: ['landscape', 'portrait', 'squarish'].includes(orientation) ? orientation : 'landscape',
      orderBy: ['relevant', 'latest'].includes(orderBy) ? orderBy : 'relevant'
    }
    
    const photos = await unsplashService.searchPhotos(searchOptions)
    
    return NextResponse.json({
      success: true,
      data: {
        query: searchQuery,
        photos: photos.map(photo => ({
          id: photo.id,
          description: photo.description,
          altDescription: photo.altDescription,
          photoUrl: photo.photoUrl,
          thumbnailUrl: photo.thumbnailUrl,
          photographer: photo.photographer,
          photographerUrl: photo.photographerUrl,
          width: photo.width,
          height: photo.height,
          likes: photo.likes,
          downloads: photo.downloads,
          tags: photo.tags,
          color: photo.color,
          createdAt: photo.createdAt
        })),
        totalFound: photos.length
      }
    })

  } catch (error) {
    console.error('Unsplash search error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Unsplash search failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}