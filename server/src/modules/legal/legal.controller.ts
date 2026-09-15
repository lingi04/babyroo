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

@Controller()
export class LegalController {
  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacyPolicy() {
    const privacyPolicyPath = resolveStaticFile(PRIVACY_POLICY_FILENAME);

    if (!privacyPolicyPath) {
      throw new NotFoundException('Privacy policy file was not found');
    }

    return new StreamableFile(createReadStream(privacyPolicyPath));
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
