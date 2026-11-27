import {
  DataTypes,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from 'sequelize';
import type { RoleModel } from './RoleModel.js';

export class UserModel extends Model<
  InferAttributes<UserModel>,
  InferCreationAttributes<UserModel>
> {
  declare id: CreationOptional<number>;
  declare login: string;
  declare passwordHash: string;
  declare fullName: string;
  declare roleId: ForeignKey<RoleModel['id']>;
  declare isActive: CreationOptional<boolean>;
  declare lastLoginAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare role?: NonAttribute<RoleModel>;

  public static initializeModel(sequelize: Sequelize): typeof UserModel {
    UserModel.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        login: {
          type: DataTypes.STRING(60),
          allowNull: false,
          unique: true,
        },
        passwordHash: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        fullName: {
          type: DataTypes.STRING(150),
          allowNull: false,
        },
        roleId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        lastLoginAt: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: 'users',
        underscored: true,
      },
    );
    return UserModel;
  }
}
