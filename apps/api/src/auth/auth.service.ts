import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import {
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { uuid } from 'short-uuid';
import { AuthRole } from './auth.role';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthGuard');

  public constructor(@InjectRedis() private readonly redis: Redis) {}

  public async limited(apiKey: string, weight: number, role: AuthRole): Promise<boolean> {
    const hash = this.hash(apiKey);

    const [name, ...keyInfo] = await this.redis.hmget(`key:${hash}`, 'name', 'role', 'limit');

    if (name === null) throw new UnauthorizedException();

    const [apiKeyRole, apiKeyLimit] = keyInfo.map(Number);

    if (apiKeyRole < role) throw new ForbiddenException();

    const pipeline = this.redis.pipeline();

    const time = Date.now();
    const expirey = 60000;

    const key = `ratelimit:${hash}`;

    pipeline.zremrangebyscore(key, 0, time - expirey);
    pipeline.zadd(key, time, `${uuid()}:${weight}`);
    pipeline.zrange(key, 0, -1, 'WITHSCORES');
    pipeline.hincrby(`key:${hash}`, 'requests', weight);
    pipeline.expire(key, expirey / 1000);

    const [, , requests] = await pipeline.exec();

    if (requests[0]) throw new InternalServerErrorException();

    const weightedTotal = (requests[1] as string[])
      .filter((_, i) => i % 2 === 0)
      .reduce((acc, key) => acc + Number(key.split(':')[1]), 0);

    if (weightedTotal > apiKeyLimit) {
      this.logger.warn(
        `${name} has exceeded their request limit of ${apiKeyLimit} and has requested ${weightedTotal} times`
      );

      throw new HttpException('Too Many Requests', 429);
    }

    return true;
  }

  public async createKey(name: string): Promise<string> {
    const apiKey = uuid().replace(/-/g, '');
    const hash = this.hash(apiKey);

    await this.redis.hmset(
      `key:${hash}`,
      'name',
      name,
      'role',
      AuthRole.MEMBER,
      'limit',
      30,
      'requests',
      0
    );

    return apiKey;
  }

  private hash(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }
}
