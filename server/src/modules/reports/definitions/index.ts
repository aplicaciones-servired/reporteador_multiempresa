import type { EnvironmentConfig } from '../../../config/EnvironmentConfig.js';
import { ReportRegistry } from '../core/ReportRegistry.js';
import { ColocadoresActivosReport } from './comercial/ColocadoresActivosReport.js';
import { ComisionesReport } from './comercial/ComisionesReport.js';
import { UtilidadesGirosReport } from './comercial/UtilidadesGirosReport.js';
import { CantidadGeneradosReport } from './conciliacion/CantidadGeneradosReport.js';
import { ConsolidadoGeneradosReport } from './conciliacion/ConsolidadoGeneradosReport.js';
import { ConsolidadoPagadosReport } from './conciliacion/ConsolidadoPagadosReport.js';
import { DetalleIncentivos3CFReport } from './conciliacion/DetalleIncentivos3CFReport.js';
import { DetallePremiosGeneradosReport } from './conciliacion/DetallePremiosGeneradosReport.js';
import { DetallePremiosPagadosReport } from './conciliacion/DetallePremiosPagadosReport.js';
import { ConsultaDevolucionesReport } from './devoluciones/ConsultaDevolucionesReport.js';
import { PlanoDevolucionesReport } from './devoluciones/PlanoDevolucionesReport.js';
import { RechazadosReport } from './devoluciones/RechazadosReport.js';
import { GanadoresDiarioReport } from './ganadores/GanadoresDiarioReport.js';
import { PremiosAstroReport } from './juegos/PremiosAstroReport.js';
import { UsuariosAstroSisbetReport } from './juegos/UsuariosAstroSisbetReport.js';
import { VendedoresBalotoReport } from './juegos/VendedoresBalotoReport.js';
import { PremiosLoteriaVirtualReport } from './loteria/PremiosLoteriaVirtualReport.js';
import { InventarioRaspeVendedorReport } from './naos/InventarioRaspeVendedorReport.js';
import { PremiosMaquinasRutaReport } from './naos/PremiosMaquinasRutaReport.js';
import { PremiosPagadosNaosReport } from './naos/PremiosPagadosNaosReport.js';
import { RaspeBodegaReport } from './naos/RaspeBodegaReport.js';
import { RecaudosMaquinasRutaReport } from './naos/RecaudosMaquinasRutaReport.js';
import { RecaudosReport } from './naos/RecaudosReport.js';
import { RedencionBoletasReport } from './naos/RedencionBoletasReport.js';
import { VentasLfColocadorReport } from './naos/VentasLfColocadorReport.js';
import { VentasRaspeColocadorReport } from './naos/VentasRaspeColocadorReport.js';
import { ExistenciaRollosReport } from './rollos/ExistenciaRollosReport.js';
import { RollosSucursalBnetReport } from './rollos/RollosSucursalBnetReport.js';

export class DefaultReportRegistryFactory {
  public static create(config: EnvironmentConfig): ReportRegistry {
    const registry = new ReportRegistry();
    registry.registerMany([
      new GanadoresDiarioReport(),
      new ConsolidadoGeneradosReport(),
      new ConsolidadoPagadosReport(),
      new DetallePremiosGeneradosReport(),
      new DetallePremiosPagadosReport(),
      new CantidadGeneradosReport(config.oracle.beneliteHistTable),
      new DetalleIncentivos3CFReport(),
      new ConsultaDevolucionesReport(),
      new PlanoDevolucionesReport(),
      new RechazadosReport(),
      new PremiosLoteriaVirtualReport(),
      new VendedoresBalotoReport(),
      new UsuariosAstroSisbetReport(),
      new PremiosAstroReport(),
      new ColocadoresActivosReport(),
      new ComisionesReport(),
      new UtilidadesGirosReport(),
      new ExistenciaRollosReport(),
      new RollosSucursalBnetReport(),
      new PremiosPagadosNaosReport(),
      new RecaudosReport(),
      new RaspeBodegaReport(),
      new InventarioRaspeVendedorReport(),
      new RedencionBoletasReport(),
      new VentasLfColocadorReport(),
      new VentasRaspeColocadorReport(),
      new RecaudosMaquinasRutaReport(),
      new PremiosMaquinasRutaReport(),
    ]);
    return registry;
  }
}
