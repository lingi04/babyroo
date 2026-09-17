import { BadRequestException, Body, Controller, Delete, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../common/auth.guard';
import { CurrentUser, RequestUser } from '../../../common/current-user.decorator';
import { PUSH_DEVICE_REPOSITORY, PushDeviceRepository } from '../application/push-device.repository';

@Controller('users/me/push-devices')
@UseGuards(AuthGuard)
export class PushDevicesController {
  constructor(@Inject(PUSH_DEVICE_REPOSITORY) private readonly devices: PushDeviceRepository) {}

  @Post()
  async register(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    if (!body || typeof body !== 'object') throw new BadRequestException('Invalid push device');
    const input = body as Record<string, unknown>;
    // Older app builds registered FCM tokens without an explicit provider.
    const provider = input.provider === undefined ? 'fcm' : input.provider;
    if (
      typeof provider !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(provider) ||
      typeof input.installationId !== 'string' ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(input.installationId) ||
      typeof input.token !== 'string' || input.token.length < 1 || input.token.length > 4096 ||
      /\s/.test(input.token) ||
      (input.platform !== 'android' && input.platform !== 'ios')
    ) throw new BadRequestException('Invalid push device');

    await this.devices.register({
      userId: user.id,
      installationId: input.installationId,
      token: input.token,
      provider,
      platform: input.platform,
    });
    return { registered: true };
  }

  @Delete(':installationId')
  async remove(@CurrentUser() user: RequestUser, @Param('installationId') installationId: string) {
    await this.devices.remove(user.id, installationId);
    return { removed: true };
  }
}
