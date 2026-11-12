import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ShowingEntity } from '../../showings/entities/showing-record.entity';

@Entity({ name: 'films' })
export class FilmEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes!: number;

  @Column({ name: 'release_year', type: 'int' })
  releaseYear!: number;

  @OneToMany(() => ShowingEntity, (showing) => showing.film)
  showings!: ShowingEntity[];
}
