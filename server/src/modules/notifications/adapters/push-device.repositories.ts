import { getPrismaClient } from '../../../common/prisma-client';
import { PushDevice, PushDeviceRepository } from '../application/push-device.repository';

export class PrismaPushDeviceRepository implements PushDeviceRepository {
  private readonly prisma = getPrismaClient();

  async register(device: PushDevice): Promise<void> {
    // One installation belongs to the currently signed-in account only.
    await this.prisma.$transaction([
      this.prisma.pushDevice.deleteMany({
        where: { provider: device.provider, token: device.token, installationId: { not: device.installationId } },
      }),
      this.prisma.pushDevice.upsert({
        where: { installationId: device.installationId },
        create: device,
        update: device,
      }),
    ]);
  }

  async remove(userId: string, installationId: string): Promise<void> {
    await this.prisma.pushDevice.deleteMany({ where: { userId, installationId } });
  }

  async removeInvalidToken(provider: string, token: string): Promise<void> {
    await this.prisma.pushDevice.deleteMany({ where: { provider, token } });
  }

  async listByUser(userId: string): Promise<PushDevice[]> {
    const devices = await this.prisma.pushDevice.findMany({ where: { userId } });
    return devices.filter((device): device is typeof device & { platform: PushDevice['platform'] } =>
      device.platform === 'android' || device.platform === 'ios');
  }
}

export class InMemoryPushDeviceRepository implements PushDeviceRepository {
  private readonly devices = new Map<string, PushDevice>();

  async register(device: PushDevice): Promise<void> {
    await this.removeInvalidToken(device.provider, device.token);
    this.devices.set(device.installationId, device);
  }

  async remove(userId: string, installationId: string): Promise<void> {
    if (this.devices.get(installationId)?.userId === userId) {
      this.devices.delete(installationId);
    }
  }

  async removeInvalidToken(provider: string, token: string): Promise<void> {
    for (const device of this.devices.values()) {
      if (device.provider === provider && device.token === token) this.devices.delete(device.installationId);
    }
  }

  async listByUser(userId: string): Promise<PushDevice[]> {
    return [...this.devices.values()].filter(device => device.userId === userId);
  }
}
