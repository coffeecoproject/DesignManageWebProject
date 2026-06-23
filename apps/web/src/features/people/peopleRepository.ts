import { peopleMembers } from './mockData';
import { clonePeopleMember } from './peopleDomain';
import type { PeopleMember } from './peopleTypes';

export type PeopleRepositorySnapshot = {
  peopleRows: PeopleMember[];
};

export type PeopleRepository = {
  getInitialSnapshot: () => PeopleRepositorySnapshot;
};

export const peopleMockRepository: PeopleRepository = {
  getInitialSnapshot() {
    return {
      peopleRows: peopleMembers.map(clonePeopleMember)
    };
  }
};
