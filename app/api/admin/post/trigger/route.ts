import { NextRequest, NextResponse } from 'next/server';
import { postNextContent } from '@/lib/services/posting-service';
import { 
  validateRequestMethod,
  createSuccessResponse,
  handleApiError,
  authenticateAdmin
} from '@/lib/api-middleware';

export async function POST(request: NextRequest) {
  try {
    validateRequestMethod(request, ['POST']);
    await authenticateAdmin(request);
    
    console.log('🎯 Manual post trigger requested...');
    
    // Use the enhanced posting service
    const result = await postNextContent();
    
    if (result.success) {
      return createSuccessResponse({
        contentId: result.contentId,
        contentText: result.contentText,
        platform: result.platform,
        timeSlot: result.timeSlot,
        postedAt: result.postedAt,
        postOrder: result.postOrder
      }, 'Content posted successfully');
    } else {
      return NextResponse.json({
        success: false,
        message: result.error || 'Failed to post content'
      }, { status: result.error?.includes('No approved content') ? 404 : 500 });
    }
    
  } catch (error) {
    return handleApiError(error, request, '/api/admin/post/trigger');
  }
}