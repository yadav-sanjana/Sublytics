import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuthPayload, JwtClaims } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(params: { email: string; password: string }): Promise<AuthPayload> {
    const email = params.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(params.password, 12);
    const user = await this.users.createUser({ email, passwordHash });
    return this.issueToken(user);
  }

  async login(params: { email: string; password: string }): Promise<AuthPayload> {
    const email = params.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(params.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueToken(user);
  }

  private issueToken(user: { id: number; email: string; role: any }): AuthPayload {
    const ttlSeconds = this.config.get<number>('JWT_ACCESS_TOKEN_TTL_SECONDS') ?? 900;
    const claims: JwtClaims = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwt.sign(claims, {
      expiresIn: ttlSeconds,
    });

    return { accessToken, user: user as any };
  }
}

