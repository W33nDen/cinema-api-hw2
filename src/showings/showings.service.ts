import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parseIsoDateTime } from '../common/utils/date.utils';
import { FilmsService } from '../films/films.service';
import { HallsService } from '../halls/halls.service';
import { CreateShowingDto } from './dto/create-showing.dto';
import { FindShowingsQueryDto } from './dto/find-showings-query.dto';
import { Showing, ShowingView } from './entities/showing.entity';
import { ShowingEntity } from './entities/showing-record.entity';
import { FilmEntity } from '../films/entities/film-record.entity';
import { HallEntity } from '../halls/entities/hall-record.entity';

export interface PaginatedShowings {
  items: ShowingView[];
  total: number;
  page: number;
  limit: number;
}

type ShowingRow = Pick<
  ShowingView,
  'id' | 'price' | 'filmTitle' | 'hallName'
> & {
  startsAt: Date | string;
};

@Injectable()
export class ShowingsService {
  constructor(
    @InjectRepository(ShowingEntity)
    private readonly showings: Repository<ShowingEntity>,
    private readonly filmsService: FilmsService,
    private readonly hallsService: HallsService,
  ) {}

  async create(dto: CreateShowingDto): Promise<ShowingView> {
    const [film, hall] = await Promise.all([
      this.filmsService.findById(dto.filmId),
      this.hallsService.findById(dto.hallId),
    ]);
    const errors: string[] = [];
    if (!film) errors.push(`Фільм з id ${dto.filmId} не знайдено`);
    if (!hall) errors.push(`Зал з id ${dto.hallId} не знайдено`);
    const startsAt = parseIsoDateTime(dto.startsAt);
    if (!startsAt || startsAt.getTime() <= Date.now())
      errors.push('startsAt має бути в майбутньому');
    if (errors.length) throw new BadRequestException(errors);
    try {
      const showing = await this.showings.save(
        this.showings.create({
          filmId: dto.filmId,
          hallId: dto.hallId,
          startsAt: startsAt!,
          price: dto.price,
        }),
      );
      return this.toView(showing, film!.title, hall!.name);
    } catch (error) {
      if ((error as { code?: string }).code === '23503') {
        throw new BadRequestException(['Фільм або зал більше не існує']);
      }
      throw error;
    }
  }

  async findAll(query: FindShowingsQueryDto): Promise<PaginatedShowings> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.showings
      .createQueryBuilder('showing')
      .innerJoin(FilmEntity, 'film', 'film.id = showing.film_id')
      .innerJoin(HallEntity, 'hall', 'hall.id = showing.hall_id')
      .select([
        'showing.id AS id',
        'showing.film_id AS "filmId"',
        'showing.hall_id AS "hallId"',
        'showing.starts_at AS "startsAt"',
        'showing.price AS price',
        'film.title AS "filmTitle"',
        'hall.name AS "hallName"',
      ]);
    if (query.filmId)
      qb.andWhere('showing.film_id = :filmId', { filmId: query.filmId });
    if (query.date) {
      const dayStart = new Date(`${query.date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      qb.andWhere(
        'showing.starts_at >= :dayStart AND showing.starts_at < :dayEnd',
        { dayStart, dayEnd },
      );
    }
    const direction = (query.sort ?? 'asc').toUpperCase() as 'ASC' | 'DESC';
    qb.orderBy('showing.starts_at', direction).addOrderBy('showing.id', 'ASC');
    const countQb = qb.clone();
    const total = await countQb.getCount();
    const offset = (page - 1) * limit;
    // Out-of-range pages are empty, even if a huge offset would exceed bigint.
    const rows =
      offset >= total
        ? []
        : await qb
            // Raw projections with joins need LIMIT/OFFSET, not entity skip/take.
            .offset(offset)
            .limit(limit)
            .getRawMany<ShowingRow>();
    return {
      items: rows.map((row) => this.toView(row, row.filmTitle, row.hallName)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Showing> {
    const showing = await this.showings.findOneBy({ id });
    if (!showing) throw new NotFoundException(`Сеанс з id ${id} не знайдено`);
    return {
      id: showing.id,
      filmId: showing.filmId,
      hallId: showing.hallId,
      startsAt: showing.startsAt.toISOString(),
      price: showing.price,
    };
  }

  async findOneView(id: string): Promise<ShowingView> {
    const row = await this.showings
      .createQueryBuilder('showing')
      .innerJoinAndSelect('showing.film', 'film')
      .innerJoinAndSelect('showing.hall', 'hall')
      .where('showing.id = :id', { id })
      .getOne();
    if (!row) throw new NotFoundException(`Сеанс з id ${id} не знайдено`);
    return this.toView(row, row.film.title, row.hall.name);
  }

  private toView(
    showing: Pick<Showing, 'id' | 'price'> & { startsAt: string | Date },
    filmTitle: string,
    hallName: string,
  ): ShowingView {
    return {
      id: showing.id,
      filmTitle,
      hallName,
      startsAt: new Date(showing.startsAt).toISOString(),
      price: showing.price,
    };
  }
}
