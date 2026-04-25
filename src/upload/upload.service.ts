import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';
import crypto from 'crypto';

function sanitizeFilename(name: string) {
  // keep simple, safe keys
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

@Injectable()
export class UploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async requestUpload(params: { userId: number; filename: string; mimeType?: string; size?: number }) {
    const safe = sanitizeFilename(params.filename || 'file');
    const rand = crypto.randomBytes(16).toString('hex');
    const key = `users/${params.userId}/${Date.now()}-${rand}-${safe}`;

    const url = await this.s3.createPresignedPutUrl({
      key,
      contentType: params.mimeType,
      expiresInSeconds: 60 * 5,
    });

    const fileUrl = this.s3.objectUrl(key);

    const file = await this.prisma.file.create({
      data: {
        userId: params.userId,
        key,
        url: fileUrl,
        mimeType: params.mimeType ?? null,
        size: params.size ?? null,
      },
    });

    return {
      key,
      url,
      method: 'PUT',
      contentType: params.mimeType,
      file,
    };
  }

  myFiles(userId: number) {
    return this.prisma.file.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

