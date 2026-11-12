import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsCalendarDate } from '../../common/validators/is-calendar-date.validator';

export class FindShowingsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Лише сеанси цього фільму',
  })
  @IsOptional()
  @IsUUID('all', { message: '$property має бути коректним UUID' })
  filmId?: string;

  @ApiPropertyOptional({
    example: '2030-01-15',
    description: 'Лише сеанси, що починаються цього дня (YYYY-MM-DD, за UTC)',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: '$property має бути у форматі YYYY-MM-DD',
  })
  @IsCalendarDate()
  date?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '$property має бути цілим числом' })
  @Min(1, { message: '$property має бути не меншим за 1' })
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '$property має бути цілим числом' })
  @Min(1, { message: '$property має бути не меншим за 1' })
  @Max(100, { message: '$property має бути не більшим за 100' })
  limit?: number;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: '$property має бути asc або desc' })
  sort?: 'asc' | 'desc';
}
