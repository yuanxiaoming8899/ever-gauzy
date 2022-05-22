import {
	Component,
	OnInit,
	ViewChild,
	Input,
	OnDestroy,
	ChangeDetectorRef,
	TemplateRef
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	IOrganizationContact,
	IOrganizationContactCreateInput,
	IOrganizationProject,
	ComponentLayoutStyleEnum,
	IOrganization,
	IContact,
	ICountry,
	ContactType,
	ContactOrganizationInviteStatus
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, Subject, firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { InviteContactComponent } from './invite-contact/invite-contact.component';
import {
	CountryService,
	OrganizationContactService,
	OrganizationProjectsService,
	Store,
	ToastrService
} from '../../@core/services';
import { ComponentEnum } from '../../@core/constants';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import {
	EmployeeWithLinksComponent,
	ProjectComponent
} from '../../@shared/table-components';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../@shared/pagination/pagination-filter-base.component';
import { ContactWithTagsComponent } from '../../@shared/table-components/contact-with-tags/contact-with-tags.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-contact',
	templateUrl: './contact.component.html',
	styleUrls: ['./contact.component.scss']
})
export class ContactComponent
	extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy
{
	showAddCard: boolean;
	organizationContacts: IOrganizationContact[] = [];
	projectsWithoutOrganizationContacts: IOrganizationProject[] = [];
	selectedOrganizationContact: IOrganizationContact;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.CARDS_GRID;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	contactOrganizationInviteStatus = ContactOrganizationInviteStatus;
	settingsSmartTable: object;
	disableButton = true;
	countries: ICountry[] = [];
	loading: boolean;
	smartTableSource = new LocalDataSource();

	subject$: Subject<any> = new Subject();
	public organization: IOrganization;
	selectedEmployeeId: string;

	/*
	 * Getter & Setter for contact type
	 */
	_contactType: string = ContactType.CUSTOMER;
	get contactType(): string {
		return this._contactType;
	}
	@Input() set contactType(value: string) {
		this._contactType = value;
	}

	contactsTable: Ng2SmartTableComponent;
	@ViewChild('contactsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.contactsTable = content;
			this.onChangedSource();
		}
	}

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true })
	actionButtons: TemplateRef<any>;

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly countryService: CountryService,
		private readonly cd: ChangeDetectorRef,
		private readonly _router: Router
	) {
		super(translateService);
		this.setView();
		this.countryService.find$.next(true);
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => (this.loading = true)),
				tap(() => this.loadOrganizationContacts()),
				tap(() => this.loadProjectsWithoutOrganizationContacts()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
					this.subject$.next(true);
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter(
					(params) =>
						!!params && params.get('openAddDialog') === 'true'
				),
				debounceTime(1000),
				tap(() => this.add()),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(untilDestroyed(this))
			.subscribe((params) => {
				if (params.get('id')) {
					this._initEditMethod(params.get('id'));
				}
			});
		this.countryService.countries$
			.pipe(
				tap((countries: ICountry[]) => (this.countries = countries)),
				tap(() => this.loadSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _initEditMethod(id: string) {
		if (id) {
			const { tenantId } = this.store.user;
			this.organizationContactService
				.getById(id, tenantId, [
					'projects',
					'members',
					'members.user',
					'tags',
					'contact'
				])
				.then((items) => {
					if (items) {
						this.editOrganizationContact(items);
					}
				})
				.catch(() => {
					this.toastrService.danger(
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
				})
				.finally(() => {
					this.loading = false;
					this.cd.detectChanges();
				});
		}
	}

	async loadSmartTable() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'custom',
					class: 'align-row',
					renderComponent: ContactWithTagsComponent,
					width: '15%'
				},
				members: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MEMBERS'
					),
					type: 'custom',
					renderComponent: EmployeeWithLinksComponent,
					filter: false
				},
				primaryPhone: {
					title: this.getTranslation('CONTACTS_PAGE.PHONE'),
					type: 'string'
				},
				primaryEmail: {
					title: this.getTranslation('CONTACTS_PAGE.EMAIL'),
					type: 'string'
				},
				projects: {
					title: this.getTranslation('CONTACTS_PAGE.PROJECTS'),
					type: 'custom',
					renderComponent: ProjectComponent
				},
				country: {
					title: this.getTranslation('CONTACTS_PAGE.COUNTRY'),
					type: 'string',
					valuePrepareFunction: (value, item) => {
						return this.getCountry(item);
					}
				},
				city: {
					title: this.getTranslation('CONTACTS_PAGE.CITY'),
					type: 'string'
				},
				street: {
					title: this.getTranslation('CONTACTS_PAGE.STREET'),
					type: 'string'
				}
			}
		};
	}

	public onUpdateResult(params: any) {
		if (params) this.invite(params);
	}

	selectContact({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedOrganizationContact = isSelected ? data : null;
	}

	async removeOrganizationContact(id?: string, name?: string) {
		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Contact'
				}
			}).onClose
		);

		if (result) {
			await this.organizationContactService.delete(
				this.selectedOrganizationContact
					? this.selectedOrganizationContact.id
					: id
			);

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.REMOVE_CONTACT',
				{
					name: this.selectedOrganizationContact
						? this.selectedOrganizationContact.name
						: name
				}
			);

			this.loadOrganizationContacts();
		}
	}

	setView() {
		this.viewComponentName = ComponentEnum.CONTACTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				tap(() => this.refreshPagination()),
				untilDestroyed(this)
			)
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedOrganizationContact =
					this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID
						? null
						: this.selectedOrganizationContact;
			});
	}

	public async addOrEditOrganizationContact(
		organizationContact: IOrganizationContactCreateInput
	) {
		const contact: IContact = {
			country: organizationContact.country,
			city: organizationContact.city,
			address: organizationContact.address,
			address2: organizationContact.address2,
			postcode: organizationContact.postcode,
			fax: organizationContact.fax,
			fiscalInformation: organizationContact.fiscalInformation,
			website: organizationContact.website,
			latitude: organizationContact.latitude,
			longitude: organizationContact.longitude
		};
		const organizationContactData = {
			...organizationContact,
			contact
		};
		if (organizationContact.name) {
			await this.organizationContactService.create(
				organizationContactData
			);

			this.showAddCard = !this.showAddCard;

			let toasterMessage: string =
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT';
			if (organizationContact.id) {
				toasterMessage =
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.UPDATE_CONTACT';
			}
			this.toastrService.success(toasterMessage, {
				name: organizationContact.name
			});

			this.loadOrganizationContacts();
		} else {
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.INVALID_CONTACT_DATA'
			);
		}
	}

	private async loadOrganizationContacts() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { activePage, itemsPerPage } = this.getPagination();
		const findObj = {
			organizationId,
			tenantId,
			contactType: this.contactType
		};
		if (this.selectedEmployeeId) {
			findObj['employeeId'] = this.selectedEmployeeId;
		}

		this.organizationContactService
			.getAll(
				[
					'projects',
					'projects.organization',
					'members',
					'members.user',
					'tags',
					'contact'
				],
				findObj
			)
			.then(({ items = [] }) => {
				const result = [];
				items.forEach((contact: IOrganizationContact) => {
					result.push({
						...contact,
						country: contact.contact ? contact.contact.country : '',
						city: contact.contact ? contact.contact.city : '',
						street: contact.contact ? contact.contact.address : '',
						street2: contact.contact
							? contact.contact.address2
							: '',
						postcode: contact.contact
							? contact.contact.postcode
							: null,
						fax: contact.contact ? contact.contact.fax : '',
						website: contact.contact ? contact.contact.website : '',
						fiscalInformation: contact.contact
							? contact.contact.fiscalInformation
							: ''
					});
				});
				this.smartTableSource.setPaging(
					activePage,
					itemsPerPage,
					false
				);
				this.organizationContacts = result;
				this.smartTableSource.load(result);
				this._loadGridLayoutData();
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			})
			.catch(() => {
				this.toastrService.danger(
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
			})
			.finally(() => {
				this.loading = false;
				this.cd.detectChanges();
			});
	}

	private async _loadGridLayoutData() {
		if (this.componentLayoutStyleEnum.CARDS_GRID === this.dataLayoutStyle) {
			this.organizationContacts =
				await this.smartTableSource.getElements();
		}
	}

	private async loadProjectsWithoutOrganizationContacts() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.organizationProjectsService
			.getAll(['organizationContact'], {
				organizationId,
				tenantId,
				organizationContact: null
			})
			.then(({ items }) => {
				this.projectsWithoutOrganizationContacts = items;
			})
			.catch(() => {
				this.toastrService.danger(
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
			})
			.finally(() => {
				this.loading = false;
				this.cd.detectChanges();
			});
	}

	cancel() {
		this.selectedOrganizationContact = null;
		this.showAddCard = !this.showAddCard;
	}

	async editOrganizationContact(organizationContact: IOrganizationContact) {
		await this.loadProjectsWithoutOrganizationContacts();
		this.selectedOrganizationContact = organizationContact;
		this.showAddCard = true;
	}

	async add() {
		this.selectedOrganizationContact = null;
		this.showAddCard = true;
	}

	/**
	 * Redirect contact/client/customer to view page
	 *
	 * @returns
	 */
	navigateToContact(selectedItem?: IContact) {
		if (selectedItem) {
			this.selectContact({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!this.selectedOrganizationContact) {
			return;
		}
		const { id } = this.selectedOrganizationContact;
		this._router.navigate([`/pages/contacts/view`, id]);
	}

	async invite(selectedOrganizationContact?: IOrganizationContact) {
		try {
			const { id: organizationId } = this.organization;
			const dialog = this.dialogService.open(InviteContactComponent, {
				context: {
					organizationId,
					organizationContact: selectedOrganizationContact,
					contactType: this.contactType,
					selectedOrganization: this.organization
				}
			});

			const result = await firstValueFrom(dialog.onClose);

			if (result) {
				await this.loadOrganizationContacts();
				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.INVITE_CONTACT',
					{
						name: result.name
					}
				);
			}
		} catch (error) {
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.INVITE_CONTACT_ERROR'
			);
		}
	}

	public _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.contactsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectContact({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.contactsTable && this.contactsTable.grid) {
			this.contactsTable.grid.dataSet['willSelect'] = 'false';
			this.contactsTable.grid.dataSet.deselectAll();
		}
	}

	getCountry(row) {
		const find: ICountry = this.countries.find(
			(item) => item.isoCode === row.country
		);
		return find ? find.country : row.country;
	}

	ngOnDestroy(): void {}
}
