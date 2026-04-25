import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  listUsers() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  }

  createUser(params: { email: string; passwordHash: string; role?: Role }) {
    const { email, passwordHash, role } = params;
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role ?? Role.user,
      },
    });
  }
}

