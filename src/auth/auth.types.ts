import { Field, ObjectType } from '@nestjs/graphql';
import { User } from '../users/user.graphql';

@ObjectType()
export class AuthPayload {
  @Field()
  accessToken!: string;

  @Field(() => User)
  user!: User;
}

export type JwtClaims = {
  sub: number;
  role: 'user' | 'admin';
  email: string;
};

