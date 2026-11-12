import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ShowingEntity } from '../../showings/entities/showing-record.entity';
import { BookingSeatEntity } from './booking-seat.entity';

@Entity({ name: 'bookings' })
export class BookingEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'showing_id', type: 'uuid' })
  showingId!: string;

  @Column({ name: 'total_price', type: 'int' })
  totalPrice!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => ShowingEntity, (showing) => showing.bookings, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'showing_id', referencedColumnName: 'id' })
  showing!: ShowingEntity;

  @OneToMany(() => BookingSeatEntity, (seat) => seat.booking)
  seats!: BookingSeatEntity[];
}
