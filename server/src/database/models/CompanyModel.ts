import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

export class CompanyModel extends Model<
  InferAttributes<CompanyModel>,
  InferCreationAttributes<CompanyModel>
> {
  declare id: CreationOptional<number>;
  declare code: string;
  declare name: string;
  declare cityLabel: string;
  declare nit: string;
  declare legalName: string;
  declare warehouseCode: string;
  declare sisbetCode: string;
  declare legacyZones: string[];
  declare costCenters: number[];
  declare daneCodes: number[];
  declare registrocajasUnits: string[];
  declare excludedChanceGames: number[];
  declare requirePositiveCash: boolean;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  public static initializeModel(sequelize: Sequelize): typeof CompanyModel {
    CompanyModel.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        code: {
          type: DataTypes.STRING(20),
          allowNull: false,
          unique: true,
        },
        name: {
          type: DataTypes.STRING(80),
          allowNull: false,
        },
        cityLabel: {
          type: DataTypes.STRING(80),
          allowNull: false,
        },
        nit: {
          type: DataTypes.STRING(30),
          allowNull: false,
        },
        legalName: {
          type: DataTypes.STRING(150),
          allowNull: false,
        },
        warehouseCode: {
          type: DataTypes.STRING(20),
          allowNull: false,
        },
        sisbetCode: {
          type: DataTypes.STRING(10),
          allowNull: false,
        },
        legacyZones: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
        },
        costCenters: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
        },
        daneCodes: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
        },
        registrocajasUnits: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
        },
        excludedChanceGames: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
        },
        requirePositiveCash: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
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
        tableName: 'companies',
        underscored: true,
      },
    );
    return CompanyModel;
  }
}
