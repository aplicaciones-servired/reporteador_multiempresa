import type { Sequelize } from 'sequelize';
import { CompanyModel } from './CompanyModel.js';
import { ReportModel } from './ReportModel.js';
import { RoleCompanyModel } from './RoleCompanyModel.js';
import { RoleModel } from './RoleModel.js';
import { RoleReportModel } from './RoleReportModel.js';
import { UserModel } from './UserModel.js';

export class ModelRegistry {
  public static registerAll(sequelize: Sequelize): void {
    CompanyModel.initializeModel(sequelize);
    RoleModel.initializeModel(sequelize);
    UserModel.initializeModel(sequelize);
    ReportModel.initializeModel(sequelize);
    RoleCompanyModel.initializeModel(sequelize);
    RoleReportModel.initializeModel(sequelize);

    RoleModel.hasMany(UserModel, { foreignKey: 'roleId', as: 'users' });
    UserModel.belongsTo(RoleModel, { foreignKey: 'roleId', as: 'role' });

    RoleModel.belongsToMany(CompanyModel, {
      through: RoleCompanyModel,
      foreignKey: 'roleId',
      otherKey: 'companyId',
      as: 'companies',
    });
    CompanyModel.belongsToMany(RoleModel, {
      through: RoleCompanyModel,
      foreignKey: 'companyId',
      otherKey: 'roleId',
      as: 'roles',
    });

    RoleModel.belongsToMany(ReportModel, {
      through: RoleReportModel,
      foreignKey: 'roleId',
      otherKey: 'reportId',
      as: 'reports',
    });
    ReportModel.belongsToMany(RoleModel, {
      through: RoleReportModel,
      foreignKey: 'reportId',
      otherKey: 'roleId',
      as: 'roles',
    });
  }
}

export {
  CompanyModel,
  ReportModel,
  RoleCompanyModel,
  RoleModel,
  RoleReportModel,
  UserModel,
};
