import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { put } from '@vercel/blob';
import { AdminAuthGuard } from '../../../../common/admin-auth.guard';
import { createId } from '../../../../common/id';

type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Controller('admin/uploads')
@UseGuards(AdminAuthGuard)
export class AdminUploadsController {
  @Post('event-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadEventImage(
    @UploadedFile() file: UploadedImage | undefined,
    @Body('eventId') eventId?: string,
    @Body('tempId') tempId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Only jpeg, png, and webp images are allowed');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image must be 5MB or smaller');
    }

    const ownerId = this.safePathSegment(eventId || tempId || createId('temp'));
    const extension = ALLOWED_IMAGE_TYPES.get(file.mimetype);
    const pathname = `event-images/${ownerId}/${createId('image')}.${extension}`;
    const blob = await put(pathname, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
    });

    return {
      imageUrl: blob.url,
    };
  }

  private safePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  }
}
