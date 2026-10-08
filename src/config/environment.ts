import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsUrl, Max, Min, validateSync } from 'class-validator';

export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

export class EnvironmentVariables {
  @IsIn(NODE_ENVIRONMENTS)
  NODE_ENV!: NodeEnvironment;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65_535)
  PORT!: number;

  @IsIn(LOG_LEVELS)
  LOG_LEVEL!: LogLevel;

  @IsUrl({
    protocols: ['postgres', 'postgresql'],
    require_protocol: true,
    require_tld: false,
  })
  DATABASE_URL!: string;

  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(10_000)
  POSTGRES_READINESS_TIMEOUT_MS!: number;
}

export function validateEnvironment(input: Record<string, unknown>): EnvironmentVariables {
  const candidate = plainToInstance(EnvironmentVariables, input, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(candidate, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    const details = errors.flatMap((error) => Object.values(error.constraints ?? {})).join('; ');

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return candidate;
}
