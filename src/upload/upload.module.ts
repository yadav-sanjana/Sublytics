import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { UploadService } from './upload.service';
import { UploadResolver } from './upload.resolver';

@Module({
  providers: [S3Service, UploadService, UploadResolver],
})
export class UploadModule {}

