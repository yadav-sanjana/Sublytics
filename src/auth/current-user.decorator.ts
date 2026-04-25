import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator((_, ctx: ExecutionContext) => {
  const gqlCtx = GqlExecutionContext.create(ctx);
  const req = gqlCtx.getContext<{ req: any }>().req;
  return req.user;
});

