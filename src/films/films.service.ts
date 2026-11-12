import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFilmDto } from './dto/create-film.dto';
import { UpdateFilmDto } from './dto/update-film.dto';
import { FilmEntity } from './entities/film-record.entity';
import { Film } from './entities/film.entity';
import { ShowingEntity } from '../showings/entities/showing-record.entity';

@Injectable()
export class FilmsService {
  private readonly logger = new Logger(FilmsService.name);

  constructor(
    @InjectRepository(FilmEntity)
    private readonly films: Repository<FilmEntity>,
    @InjectRepository(ShowingEntity)
    private readonly showings: Repository<ShowingEntity>,
  ) {}

  async create(dto: CreateFilmDto): Promise<Film> {
    const film = await this.films.save(this.films.create(dto));
    this.logger.log(`Створено фільм ${film.id}`);
    return film;
  }

  findAll(): Promise<Film[]> {
    return this.films.find({ order: { title: 'ASC', id: 'ASC' } });
  }

  findById(id: string): Promise<Film | null> {
    return this.films.findOneBy({ id });
  }

  async findOne(id: string): Promise<Film> {
    const film = await this.findById(id);
    if (!film) {
      throw new NotFoundException(`Фільм з id ${id} не знайдено`);
    }
    return film;
  }

  async update(id: string, dto: UpdateFilmDto): Promise<Film> {
    const film = await this.findOne(id);
    Object.assign(film, dto);
    return this.films.save(film);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    if (await this.showings.countBy({ filmId: id })) {
      throw new ConflictException(
        `Фільм з id ${id} не можна видалити: на нього є сеанси`,
      );
    }
    try {
      await this.films.delete(id);
    } catch (error) {
      if ((error as { code?: string }).code === '23503') {
        throw new ConflictException(
          `Фільм з id ${id} не можна видалити: на нього є сеанси`,
        );
      }
      throw error;
    }
  }
}
