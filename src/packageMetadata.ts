import { readFileSync } from 'fs';
import path from 'path';

interface PackageMetadata {
  version: string;
}

export const packageMetadata = JSON.parse(
  readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')
) as PackageMetadata;
