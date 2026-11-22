import { App as AntApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { RouterProvider } from 'react-router-dom';
import { CustomerManagementProvider } from '../modules/customers';
import { FinanceBankStatementProvider, FinanceCategoryProvider, FinanceLedgerInitializationProvider, FinanceManagementProvider } from '../modules/finance';
import { FinanceSocialInsuranceProvider, SocialInsurancePolicyConfigProvider } from '../modules/social-insurance';
import { MyExpenseReviewProvider } from '../modules/my-work';
import { AuthorizationProvider, PeopleOrganizationProvider, PermissionRoleProvider, WorkCalendarProvider } from '../modules/people';
import { PerformanceRuleProvider } from '../modules/performance-rules';
import { PerformanceResultProvider, PerformanceSignatureProvider } from '../modules/performance';
import { SalaryManagementProvider } from '../modules/salary';
import { usePeopleSalaryLink, useSocialInsurancePaymentPostings } from './moduleLinks';
import { PublicAccountConfigProvider } from '../modules/public-accounts';
import { TaskConfigProvider } from '../modules/task-types';
import { TaskManagementProvider } from '../modules/tasks';
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
              <PeopleOrganizationProvider useSalaryLink={usePeopleSalaryLink}>
                <AuthorizationProvider>
                  <PerformanceRuleProvider>
                    <PerformanceSignatureProvider>
                      <CustomerManagementProvider>
                        <TaskConfigProvider>
                          <WorkCalendarProvider>
                            <FinanceCategoryProvider>
                              <PublicAccountConfigProvider>
                                <TaskManagementProvider>
                                  <PerformanceResultProvider>
                                    <FinanceLedgerInitializationProvider>
                                      <FinanceBankStatementProvider>
                                        <FinanceManagementProvider>
                                          <FinanceSocialInsuranceProvider usePaymentPostings={useSocialInsurancePaymentPostings}>
                                            <MyExpenseReviewProvider>
                                              <RouterProvider router={router} />
                                            </MyExpenseReviewProvider>
                                          </FinanceSocialInsuranceProvider>
                                        </FinanceManagementProvider>
                                      </FinanceBankStatementProvider>
                                    </FinanceLedgerInitializationProvider>
                                  </PerformanceResultProvider>
                                </TaskManagementProvider>
                              </PublicAccountConfigProvider>
                            </FinanceCategoryProvider>
                          </WorkCalendarProvider>
                        </TaskConfigProvider>
                      </CustomerManagementProvider>
                    </PerformanceSignatureProvider>
                  </PerformanceRuleProvider>
                </AuthorizationProvider>
              </PeopleOrganizationProvider>
            </SalaryManagementProvider>
          </SocialInsurancePolicyConfigProvider>
        </PermissionRoleProvider>
      </AntApp>
    </ConfigProvider>
  );
}
