import { GoogleAuth } from 'google-auth-library';
import { PushDevice } from '../application/push-device.repository';
import { PushDeliveryPort, PushNotification } from '../application/push-delivery.port';

export class FcmPushNotificationAdapter implements PushDeliveryPort {
  readonly provider = 'fcm';
  private readonly auth: GoogleAuth;

  constructor(
    private readonly projectId = process.env.FIREBASE_PROJECT_ID,
  ) {
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      ...(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
        ? { credentials: {
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          } }
        : {}),
    });
  }

  async send(device: PushDevice, notification: PushNotification): Promise<'sent' | 'invalid_token'> {
    if (device.provider !== this.provider) throw new Error('Incompatible push device provider');
    if (!this.projectId) throw new Error('FIREBASE_PROJECT_ID is missing');
    const client = await this.auth.getClient();
    try {
      await client.request({
        url: `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/messages:send`,
        method: 'POST',
        timeout: 10000,
        retry: false,
        data: { message: {
          token: device.token,
          notification: { title: notification.title, body: notification.body },
          data: notification.data,
          ...(device.platform === 'android' ? { android: {
            priority: 'high',
            notification: { channel_id: 'recommendations', tag: notification.deduplicationKey },
          } } : { apns: { payload: { aps: { sound: 'default' } } } }),
        } },
      });
      return 'sent';
    } catch (error) {
      const response = (error as { response?: { data?: { error?: { details?: { errorCode?: string }[] } } } }).response;
      if (response?.data?.error?.details?.some(detail => detail.errorCode === 'UNREGISTERED')) {
        return 'invalid_token';
      }
      throw error;
    }
  }
}
