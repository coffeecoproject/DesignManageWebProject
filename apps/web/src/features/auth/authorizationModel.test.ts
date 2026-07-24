import type { PositionManagementRecord } from '../people/peopleDomain';
import type { PeopleMember } from '../people/peopleTypes';
import { rolePermissionDefaults } from '../people/rolePermissionModel';
import {
  canAccessPerson,
  canAccessTask,
  resolveEffectiveAuthorization,
  type FrontendAccount
} from './authorizationModel';
import { canAccessRoute } from './routeAuthorization';

type UnitTest = { name: string; run: () => void };

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const account: FrontendAccount = {
  id: 'account-authorization-test',
  memberId: 'member-authorization-test',
  name: '授权测试人员',
  status: '启用',
  systemRole: '普通人员'
};

const member = {
  id: account.memberId,
  positionAssignments: [
    { effectiveFrom: '2026-01-01', id: 'assignment-executor', isPrimary: true, positionId: 'position-executor', positionName: '执行岗位', status: '生效中' },
    { effectiveFrom: '2026-06-01', id: 'assignment-reviewer', isPrimary: false, positionId: 'position-reviewer', positionName: '审核岗位', status: '生效中' }
  ]
} as PeopleMember;

const positions: PositionManagementRecord[] = [
  {
    code: 'POS-TEST-001',
    dataScopes: { people: '本人', tasks: '本人参与', customers: '关联品牌', finance: '不可访问', salary: '本人' },
    extraPermissions: [],
    files: [],
    id: 'position-executor',
    position: '执行岗位',
    roleBindings: ['设计执行角色'],
    status: '启用',
    updatedAt: '2026-06-01'
  },
  {
    code: 'POS-TEST-002',
    dataScopes: { people: '全部人员', tasks: '负责验收', customers: '全部客户', finance: '查看', salary: '本人' },
    extraPermissions: ['performance.read'],
    files: [],
    id: 'position-reviewer',
    position: '审核岗位',
    roleBindings: ['设计审核角色'],
    status: '启用',
    updatedAt: '2026-06-01'
  }
];

const permissionByRole = {
  ...rolePermissionDefaults,
  设计执行角色: ['task.read', 'task.submit'],
  设计审核角色: ['task.read', 'task.accept']
};

const tests: UnitTest[] = [
  {
    name: 'AUTH-01 merges active multi-position permissions and widest fixed scopes',
    run() {
      const result = resolveEffectiveAuthorization({ account, member, permissionByRole, positions, today: '2026-06-13' });
      assertEqual(result.businessPermissions.includes('task.submit'), true, 'executor permission should be inherited');
      assertEqual(result.businessPermissions.includes('task.accept'), true, 'reviewer permission should be inherited');
      assertEqual(result.businessPermissions.includes('performance.read'), true, 'position extra permission should be inherited');
      assertEqual(result.dataScopes.people, '全部人员', 'people scope should use the widest active position scope');
      assertEqual(result.dataScopes.tasks, '负责验收', 'task scope should use the widest active position scope');
    }
  },
  {
    name: 'AUTH-02 excludes ended assignments and disabled positions immediately',
    run() {
      const endedMember = {
        ...member,
        positionAssignments: member.positionAssignments.map((assignment) =>
          assignment.positionId === 'position-reviewer'
            ? { ...assignment, effectiveTo: '2026-06-12', status: '已结束' as const }
            : assignment
        )
      };
      const result = resolveEffectiveAuthorization({ account, member: endedMember, permissionByRole, positions, today: '2026-06-13' });
      assertEqual(result.businessPermissions.includes('task.accept'), false, 'ended assignment permissions should be removed');
      const disabledResult = resolveEffectiveAuthorization({
        account,
        member,
        permissionByRole,
        positions: positions.map((position) => position.id === 'position-reviewer' ? { ...position, status: '停用' as const } : position),
        today: '2026-06-13'
      });
      assertEqual(disabledResult.businessPermissions.includes('task.accept'), false, 'disabled position permissions should be removed');
      const departedResult = resolveEffectiveAuthorization({
        account: { ...account, systemRole: '管理员' },
        member: { ...member, status: '离职' },
        permissionByRole,
        positions,
        today: '2026-06-13'
      });
      assertEqual(departedResult.businessPermissions.length, 0, 'departed personnel should lose business permissions even with stale assignments');
      assertEqual(departedResult.systemPermissions.length > 0, true, 'account-level system permissions should remain controlled by account status');
    }
  },
  {
    name: 'AUTH-03 keeps system roles isolated from business permissions',
    run() {
      const result = resolveEffectiveAuthorization({
        account: { ...account, systemRole: '超级管理员' },
        member: undefined,
        permissionByRole,
        positions,
        today: '2026-06-13'
      });
      assertEqual(result.systemPermissions.includes('system.configuration.manage'), true, 'super admin should receive system permissions');
      assertEqual(result.businessPermissions.length, 0, 'system role must not grant business permissions');
      assertEqual(canAccessRoute(result, '/system/work-calendar'), true, 'system route should use system permissions');
      assertEqual(canAccessRoute(result, '/finance/transactions'), false, 'business route should still require a position permission');
    }
  },
  {
    name: 'AUTH-04 applies the same authorization result to route and record scopes',
    run() {
      const result = resolveEffectiveAuthorization({ account, member, permissionByRole, positions, today: '2026-06-13' });
      assertEqual(canAccessRoute(result, '/tasks/dashboard'), true, 'task route should be accessible from task permission');
      assertEqual(canAccessPerson(result, 'another-member'), true, 'merged all-people scope should allow another member');
      assertEqual(canAccessTask(result, { acceptorId: account.memberId, executorId: 'another-member' }), true, 'reviewer scope should allow assigned acceptance task');
      assertEqual(canAccessTask(result, { acceptorId: 'another-member', executorId: 'another-member' }), false, 'reviewer scope should reject unrelated task');
    }
  },
  {
    name: 'AUTH-05 disables all frontend access when the account is disabled',
    run() {
      const result = resolveEffectiveAuthorization({ account: { ...account, status: '停用' }, member, permissionByRole, positions, today: '2026-06-13' });
      assertEqual(result.businessPermissions.length, 0, 'disabled account should lose business permissions');
      assertEqual(result.systemPermissions.length, 0, 'disabled account should lose system permissions');
      assertEqual(canAccessRoute(result, '/my-work/overview'), false, 'disabled account should not access self-service routes');
    }
  },
  {
    name: 'AUTH-06 applies target authorization to redirects and denies unregistered controlled routes',
    run() {
      const result = resolveEffectiveAuthorization({ account, member, permissionByRole, positions, today: '2026-06-13' });
      assertEqual(canAccessRoute(result, '/'), false, 'root redirect should inherit people overview denial');
      assertEqual(canAccessRoute(result, '/people'), false, 'people redirect should inherit people overview denial');
      assertEqual(canAccessRoute(result, '/tasks'), true, 'task redirect should inherit task dashboard access');
      assertEqual(canAccessRoute(result, '/people/unregistered-page'), false, 'unregistered controlled route should fail closed');
      assertEqual(canAccessRoute(result, '/not-found'), true, 'unknown route should reach the not-found page');
    }
  }
];

export function runAuthorizationModelTests() {
  const failures: string[] = [];
  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { failures, passed, total: tests.length };
}
