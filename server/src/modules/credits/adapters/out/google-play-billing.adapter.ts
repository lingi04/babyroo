import { Injectable } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { createPrivateKey } from 'node:crypto';
import { ApplicationError } from '../../../../common/application-error';
import { debugLog } from '../../../../common/debug-log';
import { googlePlayErrorFields } from './google-play-error-fields';
import {
  GooglePlayBillingPort,
  GooglePlayProductPurchase,
  GooglePlayProductPurchaseRequest,
} from '../../application/ports/out/google-play-billing.port';

type AndroidPublisherProductPurchaseResponse = {
  orderId?: string;
  purchaseState?: number;
  consumptionState?: number;
  acknowledgementState?: number;
};

const ANDROID_PUBLISHER_SCOPE =
  'https://www.googleapis.com/auth/androidpublisher';

@Injectable()
export class GooglePlayBillingAdapter implements GooglePlayBillingPort {
  private auth?: GoogleAuth;

  getReadiness() {
    try {
      this.credentials();
      return { ready: true };
    } catch {
      return { ready: false };
    }
  }

  async getProductPurchase(
    request: GooglePlayProductPurchaseRequest,
  ): Promise<GooglePlayProductPurchase> {
    const client = await this.getAuth().getClient();
    const url = this.purchaseUrl(request);

    try {
      const response =
        await client.request<AndroidPublisherProductPurchaseResponse>({
          method: 'GET',
          url,
        });
      const data = response.data ?? {};

      return {
        orderId: data.orderId,
        purchaseState: data.purchaseState,
        consumptionState: data.consumptionState,
        acknowledgementState: data.acknowledgementState,
        rawResponse: data as Record<string, unknown>,
      };
    } catch (error) {
      debugLog('credits.googlePlay.verify.failure', {
        productId: request.productId,
        ...googlePlayErrorFields(error),
      });
      throw new ApplicationError(
        'GOOGLE_PLAY_PURCHASE_VERIFICATION_FAILED',
        'Google Play purchase verification failed',
        502,
      );
    }
  }

  async consumeProductPurchase(
    request: GooglePlayProductPurchaseRequest,
  ): Promise<void> {
    const client = await this.getAuth().getClient();

    try {
      await client.request({
        method: 'POST',
        url: `${this.purchaseUrl(request)}:consume`,
      });
    } catch (error) {
      debugLog('credits.googlePlay.consume.failure', {
        productId: request.productId,
        ...googlePlayErrorFields(error),
      });
      throw new ApplicationError(
        'GOOGLE_PLAY_PURCHASE_CONSUME_FAILED',
        'Google Play purchase consume failed',
        502,
      );
    }
  }

  private getAuth() {
    if (!this.auth) {
      this.auth = this.createAuth();
    }

    return this.auth;
  }

  private createAuth() {
    return new GoogleAuth({
      credentials: this.credentials(),
      scopes: [ANDROID_PUBLISHER_SCOPE],
    });
  }

  private credentials(): { client_email: string; private_key: string } {
    const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    try {
      const value = serviceAccountJson
        ? JSON.parse(serviceAccountJson)
        : {
            client_email: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY,
          };
      if (
        !value ||
        (serviceAccountJson && value.type !== 'service_account') ||
        typeof value.client_email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(value.client_email) ||
        typeof value.private_key !== 'string'
      ) {
        throw new Error('Invalid service account');
      }
      const privateKey = value.private_key.replace(/\\n/g, '\n');
      if (createPrivateKey(privateKey).asymmetricKeyType !== 'rsa') {
        throw new Error('Invalid signing key');
      }
      return { client_email: value.client_email, private_key: privateKey };
    } catch {
      throw new ApplicationError(
        'GOOGLE_PLAY_BILLING_NOT_CONFIGURED',
        'Google Play billing service account is missing or invalid',
        503,
      );
    }
  }

  private purchaseUrl({
    packageName,
    productId,
    purchaseToken,
  }: GooglePlayProductPurchaseRequest) {
    const encodedPackageName = encodeURIComponent(packageName);
    const encodedProductId = encodeURIComponent(productId);
    const encodedToken = encodeURIComponent(purchaseToken);

    return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodedPackageName}/purchases/products/${encodedProductId}/tokens/${encodedToken}`;
  }
}
