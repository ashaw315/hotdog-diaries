import { NextResponse } from 'next/server';

// Temporary in-memory storage (in production this would be database)
let tempContentStore: any[] = [];

export async function GET() {
  try {
    // If no content in memory, generate some sample content
    if (tempContentStore.length === 0) {
      tempContentStore = [
        {
          id: 'sample_1',
          title: 'Classic Chicago-style hotdog',
          content: 'A perfect Chicago dog with all the fixings!',
          imageUrl: 'https://images.unsplash.com/photo-1612392062798-2637ba04d5b4?w=500',
          platform: 'sample',
          timestamp: new Date().toISOString(),
          url: '#'
        },
        {
          id: 'sample_2', 
          title: 'Gourmet hotdog creation',
          content: 'This artisanal hotdog is a work of art.',
          imageUrl: 'https://images.unsplash.com/photo-1551615593-ef5fe247e8f7?w=500',
          platform: 'sample',
          timestamp: new Date().toISOString(),
          url: '#'
        },
        {
          id: 'sample_3',
          title: 'Street vendor hotdog',
          content: 'Nothing beats a classic street cart hotdog!',
          imageUrl: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=500',
          platform: 'sample',
          timestamp: new Date().toISOString(),
          url: '#'
        }
      ];
    }

    return NextResponse.json({
      success: true,
      content: tempContentStore,
      count: tempContentStore.length,
      message: `Retrieved ${tempContentStore.length} hotdog items`
    });

  } catch (error) {
    console.error('❌ Failed to get temp content:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      content: [],
      count: 0
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newContent = await request.json();
    
    if (Array.isArray(newContent)) {
      // Replace all content
      tempContentStore = newContent;
    } else {
      // Add single item
      tempContentStore.push(newContent);
    }

    return NextResponse.json({
      success: true,
      message: `Stored ${Array.isArray(newContent) ? newContent.length : 1} items`,
      count: tempContentStore.length
    });

  } catch (error) {
    console.error('❌ Failed to store temp content:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}