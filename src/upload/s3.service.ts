import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly region: string;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.region = config.get<string>('AWS_REGION') ?? '';
    this.bucket = config.get<string>('AWS_S3_BUCKET') ?? '';

    if (!this.region) throw new Error('AWS_REGION is missing');
    if (!this.bucket) throw new Error('AWS_S3_BUCKET is missing');

    // In production on AWS, prefer IAM roles (no static creds). We still support env creds for local/dev.
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');

    this.s3 = new S3Client({
      region: this.region,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  getBucket() {
    return this.bucket;
  }

  getRegion() {
    return this.region;
  }

  objectUrl(key: string) {
    // Virtual-hosted style (standard for most regions/buckets)
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  }

  async createPresignedPutUrl(params: { key: string; contentType?: string; expiresInSeconds?: number }) {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
    });

    const url = await getSignedUrl(this.s3, cmd, { expiresIn: params.expiresInSeconds ?? 60 * 5 });
    return url;
  }
}

