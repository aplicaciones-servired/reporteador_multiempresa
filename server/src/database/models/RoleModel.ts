import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from 'sequelize';
import type { CompanyModel } from './CompanyModel.js';
import type { ReportModel } from './ReportModel.js';

export class RoleModel extends Model<
  InferAttributes<RoleModel>,
  InferCreationAttributes<RoleModel>
> {
  declare id: CreationOptional<number>;
  declare code: string;
  declare name: string;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare companies?: NonAttribute<CompanyModel[]>;
  declare reports?: NonAttribute<ReportModel[]>;

  public static initializeModel(sequelize: Sequelize): typeof RoleModel {
    RoleModel.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        code: {
          type: DataTypes.STRING(60),
          allowNull: false,
          unique: true,
        },
        name: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: 'roles',
        underscored: true,
      },
    );
    return RoleModel;
  }
}
