import { Logger } from '@nestjs/common';
import { PushDeliveryPort, PushNotification } from './push-delivery.port';
import { PushDeviceRepository } from './push-device.repository';
import { PushNotificationPort, RecommendationCompletion } from './push-notification.port';

export class RecommendationNotificationService implements PushNotificationPort {
  private readonly logger = new Logger(RecommendationNotificationService.name);

  constructor(
    private readonly devices: PushDeviceRepository,
    private readonly delivery: PushDeliveryPort,
  ) {}

  async sendRecommendationCompleted(completion: RecommendationCompletion): Promise<void> {
    const devices = (await this.devices.listByUser(completion.userId))
      .filter(device => device.provider === this.delivery.provider);
    const notification: PushNotification = {
      title: '추천 요청이 완료됐어요',
      body: completion.status === 'success'
        ? '추천 결과가 저장됐어요. 앱에서 확인해 주세요.'
        : '추천 처리 결과가 저장됐어요. 앱에서 확인해 주세요.',
      data: {
        type: 'recommendation_completed',
        userId: completion.userId,
        sessionId: completion.sessionId,
        status: completion.status,
      },
      deduplicationKey: completion.sessionId,
    };
    await Promise.all(devices.map(async device => {
      try {
        if (await this.delivery.send(device, notification) === 'invalid_token') {
          await this.devices.removeInvalidToken(device.provider, device.token);
        }
      } catch {
        // Raw provider errors may contain tokens or credentials.
        this.logger.warn(`Push delivery failed for recommendation ${completion.sessionId}`);
      }
    }));
  }
}
