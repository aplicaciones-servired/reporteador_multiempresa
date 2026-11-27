import { EnvironmentConfig } from '../config/EnvironmentConfig.js';
import { DefaultReportRegistryFactory } from '../modules/reports/definitions/index.js';
import { SeedRunner } from './SeedRunner.js';
import { SequelizeDatabase } from './SequelizeDatabase.js';

async function main(): Promise<void> {
  const config = EnvironmentConfig.getInstance();
  const db = new SequelizeDatabase(config);
  const registry = DefaultReportRegistryFactory.create(config);

  try {
    await db.connect(true);
    const runner = new SeedRunner(config, registry.getAllMetadata());
    await runner.run();
    console.log(
      `Seed completado correctamente: ${registry.getAllMetadata().length} reportes y perfiles cargados.`,
    );
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Error ejecutando el seed:', err);
  process.exit(1);
});
