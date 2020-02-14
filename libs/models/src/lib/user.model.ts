import { Tenant } from './../../../../apps/api/src/app/tenant/tenant.entity';
// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Role } from './role.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface User extends IBaseEntityModel {
	thirdPartyId?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	startedWorkOn?: string;
	tenant: Tenant;
}

export interface UserFindInput extends IBaseEntityModel {
	thirdPartyId?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
}

export interface UserRegistrationInput {
	user: User;
	password?: string;
}

export interface UserCreateInput {
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
}
