import { atomFamily } from 'recoil';
import Collections from 'app/deprecated/CollectionsV1/Collections/Collections';

import { CompanyType } from 'app/features/companies/types/company';
import CompanyAPIClient from 'app/features/companies/api/company-api-client';
import _ from 'lodash';

export const CompaniesState = atomFamily<CompanyType | null, string>({
  key: 'CompaniesState',
  default: id => (id ? CompanyAPIClient.get(id) : null),

  //Retro compatibility
  effects_UNSTABLE: id => [
    ({ onSet }) => {
      onSet(company => Collections.get('groups').updateObject(_.cloneDeep(company)));
    },
  ],
});
