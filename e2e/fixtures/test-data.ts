// 테스트용 공통 데이터/헬퍼

export const TEST_PIN = '1234';
export const WRONG_PIN = '4321';

export const testAccount = {
  name: 'Test Account',
  url: 'https://example.com',
  username: 'testuser',
  password: 'TestPass123!',
  note: 'Test note',
  favorite: false,
};

export const testAccount2 = {
  name: 'GitHub',
  url: 'https://github.com',
  username: 'githubuser',
  password: 'GitHubPass456!',
  note: 'GitHub account',
  favorite: true,
};

export const testTemplate = {
  name: '신용카드',
  fields: [
    { type: 'text', label: '카드번호', required: true, placeholder: '1234 5678 9012 3456', defaultValue: '' },
    { type: 'text', label: '만료일', required: true, placeholder: 'MM/YY', defaultValue: '' },
    { type: 'password', label: 'CVC', required: true, placeholder: '***', defaultValue: '' },
    { type: 'text', label: '카드사', required: false, placeholder: '예: 삼성, 현대, 신한', defaultValue: '' },
  ],
};

export const testTemplate2 = {
  name: '서버 접속',
  fields: [
    { type: 'text', label: '호스트', required: true, placeholder: 'server.example.com', defaultValue: '' },
    { type: 'text', label: '포트', required: true, placeholder: '22', defaultValue: '22' },
    { type: 'text', label: '사용자명', required: true, placeholder: 'root', defaultValue: '' },
    { type: 'password', label: '비밀번호', required: true, placeholder: '********', defaultValue: '' },
    { type: 'text', label: 'SSH 키 경로', required: false, placeholder: '~/.ssh/id_rsa', defaultValue: '' },
  ],
};

export const seedAccounts = [
  { name: 'GitHub', url: 'https://github.com', username: 'devuser', password: 'GitHub123!', note: 'Personal GitHub', favorite: true },
  { name: 'Gmail', url: 'https://gmail.com', username: 'myemail@gmail.com', password: 'Gmail456!', note: 'Personal email', favorite: false },
  { name: 'AWS Console', url: 'https://aws.amazon.com/console', username: 'awsuser', password: 'AWS789!', note: 'Work AWS account', favorite: true },
  { name: 'Slack', url: 'https://slack.com', username: 'slackuser', password: 'Slack111!', note: 'Team workspace', favorite: false },
  { name: 'Notion', url: 'https://notion.so', username: 'notionuser', password: 'Notion222!', note: 'Personal wiki', favorite: false },
];

// 테스트용 간단한 대기 헬퍼
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}