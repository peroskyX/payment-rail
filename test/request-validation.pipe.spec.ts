import { IsString } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { createRequestValidationPipe } from '../src/http/request-validation.pipe.js';

class ExampleDto {
  @IsString()
  name!: string;
}

describe('request validation pipe', () => {
  it('accepts a valid DTO', async () => {
    const pipe = createRequestValidationPipe();

    await expect(
      pipe.transform(
        { name: 'RailBridge' },
        { type: 'body', metatype: ExampleDto, data: undefined },
      ),
    ).resolves.toEqual({ name: 'RailBridge' });
  });

  it('rejects unknown fields', async () => {
    const pipe = createRequestValidationPipe();

    await expect(
      pipe.transform(
        { name: 'RailBridge', unexpected: true },
        { type: 'body', metatype: ExampleDto, data: undefined },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
