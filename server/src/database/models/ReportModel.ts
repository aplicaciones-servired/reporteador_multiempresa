import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';
import type { OracleSourceName } from '../OraclePoolManager.js';

export type ReportInputSchemaType =
  | 'date_range'
  | 'single_date'
  | 'single_date_sorteo'
  | 'single_date_serie'
  | 'company_only'
  | 'document_list';

export type ReportOutputType = 'xlsx' | 'txt' | 'table_and_xlsx';

export class ReportModel extends Model<
  InferAttributes<ReportModel>,
  InferCreationAttributes<ReportModel>
> {
  declare id: CreationOptional<number>;
  declare slug: string;
  declare module: string;
  declare name: string;
  declare description: string;
  declare oracleSource: OracleSourceName;
  declare inputSchema: ReportInputSchemaType;
  declare outputType: ReportOutputType;
  declare requiresCompany: boolean;
  declare displayOrder: number;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  public static initializeModel(sequelize: Sequelize): typeof ReportModel {
    ReportModel.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        slug: {
          type: DataTypes.STRING(80),
          allowNull: false,
          unique: true,
        },
        module: {
          type: DataTypes.STRING(60),
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING(150),
          allowNull: false,
        },
        description: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: '',
        },
        oracleSource: {
          type: DataTypes.STRING(20),
          allowNull: false,
        },
        inputSchema: {
          type: DataTypes.STRING(30),
          allowNull: false,
        },
        outputType: {
          type: DataTypes.STRING(20),
          allowNull: false,
        },
        requiresCompany: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        displayOrder: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
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
        tableName: 'reports',
        underscored: true,
      },
    );
    return ReportModel;
  }
}
