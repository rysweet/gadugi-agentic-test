import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
  getPackageJsonTemplate,
  getReadmeTemplate,
  getScenarioTemplates,
} from '../init-templates';
import { packageMetadata } from '../../../packageMetadata';
import { ScenarioLoader } from '../../../scenarios';

describe('init templates', () => {
  it('pins generated projects to the installed Gadugi version', () => {
    const generatedPackage = JSON.parse(getPackageJsonTemplate('example'));

    expect(generatedPackage.devDependencies['@gadugi/agentic-test'])
      .toBe(packageMetadata.version);
    expect(generatedPackage.scripts.test).toBe('gadugi-test run');
  });

  it('documents the package Node.js requirement', () => {
    expect(getReadmeTemplate('basic')).toContain('Node.js (>= 20.0.0)');
  });

  it.each(['basic', 'electron', 'advanced'])(
    'generates valid %s scenarios',
    async (template) => {
      const directory = await mkdtemp(path.join(tmpdir(), 'gadugi-init-template-'));
      try {
        for (const [filename, scenario] of Object.entries(getScenarioTemplates(template))) {
          const scenarioPath = path.join(directory, filename);
          await writeFile(scenarioPath, scenario);
          await expect(ScenarioLoader.loadFromFile(scenarioPath)).resolves.toHaveLength(1);
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  );
});
