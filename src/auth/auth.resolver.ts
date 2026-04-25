import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthPayload } from './auth.types';
import { LoginInput, SignupInput } from './auth.inputs';
import { GqlAuthGuard } from './gql-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { User } from '../users/user.graphql';

@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Mutation(() => AuthPayload)
  signup(@Args('input') input: SignupInput) {
    return this.auth.signup(input);
  }

  @Mutation(() => AuthPayload)
  login(@Args('input') input: LoginInput) {
    return this.auth.login(input);
  }

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: { id: number }) {
    // JwtStrategy attaches id/email/role on req.user; keep return shape consistent with User GraphQL type.
    return user as any;
  }
}

