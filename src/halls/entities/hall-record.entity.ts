import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ShowingEntity } from '../../showings/entities/showing-record.entity';

@Entity({ name: 'halls' })
@Unique('uq_halls_name', ['name'])
export class HallEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ name: 'rows', type: 'int' })
  rows!: number;

  @Column({ name: 'seats_per_row', type: 'int' })
  seatsPerRow!: number;

  @OneToMany(() => ShowingEntity, (showing) => showing.hall)
  showings!: ShowingEntity[];
}
