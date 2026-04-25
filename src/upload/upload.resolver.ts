import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UploadService } from './upload.service';
import { FileObject, PresignedUploadPayload, RequestUploadInput } from './upload.graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Resolver()
export class UploadResolver {
  constructor(private readonly uploads: UploadService) {}

  @Mutation(() => PresignedUploadPayload)
  @UseGuards(GqlAuthGuard)
  requestUpload(@CurrentUser() user: { id: number }, @Args('input') input: RequestUploadInput) {
    return this.uploads.requestUpload({ userId: user.id, ...input });
  }

  @Query(() => [FileObject])
  @UseGuards(GqlAuthGuard)
  myFiles(@CurrentUser() user: { id: number }) {
    return this.uploads.myFiles(user.id);
  }
}

