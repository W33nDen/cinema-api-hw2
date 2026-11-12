import { ApiProperty } from '@nestjs/swagger';
import { ShowingView } from './showing.entity';

export class ShowingsPage {
  @ApiProperty({ type: [ShowingView] })
  items!: ShowingView[];
  @ApiProperty({ example: 42 })
  total!: number;
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
}
