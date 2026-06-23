import type { ClientFeedbackChannel } from './TaskManagementState';

export const feedbackChannelOptions: ClientFeedbackChannel[] = ['微信', '电话', '飞书', '现场', '邮件', '其他'];

export const feedbackChannelTone = {
  微信: 'green',
  电话: 'blue',
  飞书: 'purple',
  现场: 'amber',
  邮件: 'gray',
  其他: 'gray'
} as const;
