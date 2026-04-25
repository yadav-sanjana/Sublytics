import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

@ObjectType()
export class FileObject {
  @Field(() => ID)
  id!: number;

  @Field()
  key!: string;

  @Field()
  url!: string;

  @Field({ nullable: true })
  mimeType?: string;

  @Field(() => Int, { nullable: true })
  size?: number;

  @Field()
  createdAt!: Date;
}

@InputType()
export class RequestUploadInput {
  @Field()
  @IsString()
  @MinLength(1)
  filename!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}

@ObjectType()
export class PresignedUploadPayload {
  @Field()
  key!: string;

  @Field()
  url!: string;

  @Field()
  method!: string;

  // For PUT presigns, headers are usually optional; kept for extensibility.
  @Field(() => String, { nullable: true })
  contentType?: string;

  @Field(() => FileObject)
  file!: FileObject;
}

