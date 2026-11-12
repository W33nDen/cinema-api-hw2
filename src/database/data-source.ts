import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  validate,
  EnvironmentVariables,
} from '../config/environment-variables';
import { createDatabaseOptions } from './database-options';

const config = new ConfigService<EnvironmentVariables, true>(
  validate(process.env),
);
export default new DataSource(createDatabaseOptions(config));
