import {
  type RouteConfig,
  index,
  layout,
  route,
} from '@react-router/dev/routes';

export default [
  layout('routes/app-layout.tsx', [
    index('routes/home.tsx'),
    route('test-cases', 'routes/test-cases.tsx'),
    route('test-cases/new', 'routes/test-cases.new.tsx'),
    route('test-cases/:testCaseId', 'routes/test-cases.$testCaseId.tsx'),
    route(
      'test-cases/:testCaseId/runs/:testRunId',
      'routes/test-cases.$testCaseId.runs.$testRunId.tsx',
    ),
  ]),
  route('login', 'routes/login.tsx'),
  route('signup', 'routes/signup.tsx'),
] satisfies RouteConfig;
