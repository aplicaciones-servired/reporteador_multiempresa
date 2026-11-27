import {
  DataTypes,
  Model,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';
import type { CompanyModel } from './CompanyModel.js';
import type { RoleModel } from './RoleModel.js';

export class RoleCompanyModel extends Model<
  InferAttributes<RoleCompanyModel>,
  InferCreationAttributes<RoleCompanyModel>
> {
  declare roleId: ForeignKey<RoleModel['id']>;
  declare companyId: ForeignKey<CompanyModel['id']>;

  public static initializeModel(sequelize: Sequelize): typeof RoleCompanyModel {
    RoleCompanyModel.init(
      {
        roleId: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          allowNull: false,
        },
        companyId: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'role_companies',
        underscored: true,
        timestamps: false,
      },
    );
    return RoleCompanyModel;
  }
}
