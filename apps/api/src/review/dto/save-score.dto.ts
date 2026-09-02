import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SaveScoreDto {
  @IsString({ message: 'bidderId 必须是字符串' })
  @IsNotEmpty({ message: 'bidderId 不能为空' })
  bidderId!: string;

  @IsString({ message: 'expertId 必须是字符串' })
  @IsNotEmpty({ message: 'expertId 不能为空' })
  expertId!: string;

  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { message: 'score 必须是有效数字' },
  )
  score!: number;

  @IsOptional()
  @IsString({ message: 'feedback 必须是字符串' })
  feedback?: string;
}
