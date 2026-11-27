import {
  DataTypes,
  Model,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';
import type { ReportModel } from './ReportModel.js';
import type { RoleModel } from './RoleModel.js';

export class RoleReportModel extends Model<
  InferAttributes<RoleReportModel>,
  InferCreationAttributes<RoleReportModel>
> {
  declare roleId: ForeignKey<RoleModel['id']>;
  declare reportId: ForeignKey<ReportModel['id']>;

  public static initializeModel(sequelize: Sequelize): typeof RoleReportModel {
    RoleReportModel.init(
      {
        roleId: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          allowNull: false,
        },
        reportId: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'role_reports',
        underscored: true,
        timestamps: false,
      },
    );
    return RoleReportModel;
  }
}
