import {
  Controller,
  Get,
  Header,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';

const PRIVACY_POLICY_FILENAME = 'privacy-policy.html';
const ACCOUNT_DELETION_FILENAME = 'account-deletion.html';

@Controller()
export class LegalController {
  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacyPolicy() {
    return this.streamStaticFile(
      PRIVACY_POLICY_FILENAME,
      'Privacy policy file was not found',
    );
  }

  @Get('account-deletion')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getAccountDeletion() {
    return this.streamStaticFile(
      ACCOUNT_DELETION_FILENAME,
      'Account deletion file was not found',
    );
  }

  private streamStaticFile(filename: string, notFoundMessage: string) {
    const staticFilePath = resolveStaticFile(filename);

    if (!staticFilePath) {
      throw new NotFoundException(notFoundMessage);
    }

    return new StreamableFile(createReadStream(staticFilePath));
  }
}

function resolveStaticFile(filename: string) {
  const candidates = [
    join(process.cwd(), 'static', filename),
    join(process.cwd(), 'server', 'static', filename),
    join(__dirname, '..', '..', 'static', filename),
  ];

  return candidates.find(candidate => existsSync(candidate));
}
