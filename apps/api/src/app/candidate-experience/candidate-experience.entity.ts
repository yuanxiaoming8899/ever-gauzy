import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { IsString, IsNotEmpty } from 'class-validator';
import { IExperience, Candidate as ICandidate } from '@gauzy/models';
import { Candidate } from '../candidate/candidate.entity';
import { Organization } from '../organization/organization.entity';

@Entity('candidate_experience')
export class CandidateExperience extends Base implements IExperience {
	@ApiProperty({ type: String })
	@Column()
	occupation: string;

  @ApiProperty({ type: Organization })
  @ManyToOne((type) => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn()
  organization: Organization;

	@ApiProperty({ type: String })
	@Column()
	duration: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;

	@ManyToOne((type) => Candidate, (candidate) => candidate.experience)
	candidate: ICandidate;
}
