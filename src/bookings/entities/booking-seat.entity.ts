import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ShowingEntity } from '../../showings/entities/showing-record.entity';
import { BookingEntity } from './booking-record.entity';

@Entity({ name: 'booking_seats' })
@Index('uq_booking_seats_showing_row_seat', ['showingId', 'row', 'seat'], {
  unique: true,
})
export class BookingSeatEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId!: string;

  @Column({ name: 'showing_id', type: 'uuid' })
  showingId!: string;

  @Column({ name: 'row', type: 'int' })
  row!: number;

  @Column({ name: 'seat', type: 'int' })
  seat!: number;

  @ManyToOne(() => BookingEntity, (booking) => booking.seats, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id', referencedColumnName: 'id' })
  booking!: BookingEntity;

  @ManyToOne(() => ShowingEntity, (showing) => showing.bookingSeats, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'showing_id', referencedColumnName: 'id' })
  showing!: ShowingEntity;
}
