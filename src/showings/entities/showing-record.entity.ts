import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BookingEntity } from '../../bookings/entities/booking-record.entity';
import { BookingSeatEntity } from '../../bookings/entities/booking-seat.entity';
import { FilmEntity } from '../../films/entities/film-record.entity';
import { HallEntity } from '../../halls/entities/hall-record.entity';

@Entity({ name: 'showings' })
export class ShowingEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'film_id', type: 'uuid' })
  filmId!: string;

  @Column({ name: 'hall_id', type: 'uuid' })
  hallId!: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'int' })
  price!: number;

  @ManyToOne(() => FilmEntity, (film) => film.showings, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'film_id', referencedColumnName: 'id' })
  film!: FilmEntity;

  @ManyToOne(() => HallEntity, (hall) => hall.showings, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'hall_id', referencedColumnName: 'id' })
  hall!: HallEntity;

  @OneToMany(() => BookingEntity, (booking) => booking.showing)
  bookings!: BookingEntity[];

  @OneToMany(() => BookingSeatEntity, (bookingSeat) => bookingSeat.showing)
  bookingSeats!: BookingSeatEntity[];
}
