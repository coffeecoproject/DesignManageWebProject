import { App as AntApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { RouterProvider } from 'react-router-dom';
import { CustomerManagementProvider } from '../features/customers/CustomerManagementState';
import { FinanceManagementProvider } from '../features/finance/FinanceManagementState';
import { FinanceSocialInsuranceProvider } from '../features/finance/FinanceSocialInsuranceState';
import { PeopleOrganizationProvider } from '../features/people/PeopleOrganizationState';
import { PermissionRoleProvider } from '../features/people/PermissionRoleState';
import { PerformanceRuleProvider } from '../features/performance/PerformanceRuleState';
import { SalaryManagementProvider } from '../features/salary/SalaryManagementState';
import { FinanceCategoryProvider } from '../features/system/FinanceCategoryState';
import { PublicAccountConfigProvider } from '../features/system/PublicAccountConfigState';
import { SocialInsurancePolicyConfigProvider } from '../features/system/SocialInsurancePolicyConfigState';
import { TaskConfigProvider } from '../features/system/TaskConfigState';
import { WorkCalendarProvider } from '../features/system/WorkCalendarState';
import { TaskManagementProvider } from '../features/tasks/TaskManagementState';
import { router } from './router';

export function RootApp() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
        },
        components: {
          Layout: {
            bodyBg: '#f5f7fb',
            headerBg: '#ffffff',
            siderBg: '#001529'
          },
          Table: {
            headerBg: '#fafafa',
            rowHoverBg: '#f5f8ff'
          }
        }
      }}
    >
      <AntApp>
        <PermissionRoleProvider>
          <SocialInsurancePolicyConfigProvider>
            <SalaryManagementProvider>
              <PeopleOrganizationProvider>
                <FinanceSocialInsuranceProvider>
                  <PerformanceRuleProvider>
                    <CustomerManagementProvider>
                      <TaskConfigProvider>
                        <WorkCalendarProvider>
                          <FinanceCategoryProvider>
                            <PublicAccountConfigProvider>
                              <TaskManagementProvider>
                                <FinanceManagementProvider>
                                  <RouterProvider router={router} />
                                </FinanceManagementProvider>
                              </TaskManagementProvider>
                            </PublicAccountConfigProvider>
                          </FinanceCategoryProvider>
                        </WorkCalendarProvider>
                      </TaskConfigProvider>
                    </CustomerManagementProvider>
                  </PerformanceRuleProvider>
                </FinanceSocialInsuranceProvider>
              </PeopleOrganizationProvider>
            </SalaryManagementProvider>
          </SocialInsurancePolicyConfigProvider>
        </PermissionRoleProvider>
      </AntApp>
    </ConfigProvider>
  );
}
