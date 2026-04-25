import { Resolver, Query } from '@nestjs/graphql';
import { UsersService } from './users.service';
import { User } from './user.graphql';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly users: UsersService) {}

  @Query(() => [User])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.admin)
  usersList() {
    return this.users.listUsers();
  }
}

