import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProd ? 'info' : 'silent');

const errorSerializer: pino.SerializerFn = (error: Error) => {
  return {
    event: error.name,
    message: error.message,
    stack: error.stack,
  };
};

const LOGGER_OPTIONS: pino.LoggerOptions = {
  level: logLevel,
  enabled: logLevel !== 'silent',
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
  redact: ['password', 'secret', 'token'],
  serializers: {
    err: errorSerializer,
  },
  base: {
    env: process.env.NODE_ENV,
    version: process.env.npm_package_version,
  },
  browser: {
    asObject: true, // Ensures logs are output as objects in the browser
  },
};

type AgentEvent =
  | 'AGENT_ACTION'
  | 'AGENT_DECISION'
  | 'AGENT_WARNING'
  | 'AGENT_ERROR'
  | 'AGENT_PERFORMANCE';

type ApiEvent = 'API_START' | 'API_RESULT' | 'API_ERROR';

type WalletEvent =
  | 'WALLET_FLOW_START'
  | 'WALLET_FLOW_RESULT'
  | 'WALLET_FLOW_ERROR';

type LogEvent = AgentEvent | ApiEvent | WalletEvent;

interface BaseLog<T extends LogEvent> {
  event: T;
  timestamp: string;
}

interface AgentActionLog extends BaseLog<'AGENT_ACTION'> {
  agentId: string;
  action: string;
}

interface AgentDecisionLog extends BaseLog<'AGENT_DECISION'> {
  agentId: string;
  decision: string;
  reasoning: string;
}

interface AgentErrorLog extends BaseLog<'AGENT_ERROR'> {
  agentId: string;
  error: string;
  stack?: string;
}

interface AgentWarningLog extends BaseLog<'AGENT_WARNING'> {
  agentId: string;
  warning: string;
}
interface AgentPerformanceLog extends BaseLog<'AGENT_PERFORMANCE'> {
  agentId: string;
  operation: string;
  duration: number;
  success: boolean;
}

export const createBaseLog = <T extends LogEvent>(event: T): BaseLog<T> => ({
  event,
  timestamp: new Date().toISOString(),
});

export const logAgentAction = (
  agentId: string,
  action: string,
  details: Record<string, unknown>,
): void => {
  logger.info({
    ...createBaseLog('AGENT_ACTION'),
    agentId,
    action,
    ...details,
  } satisfies AgentActionLog);
};

export const logAgentDecision = (
  agentId: string,
  decision: string,
  reasoning: string,
): void => {
  logger.info({
    ...createBaseLog('AGENT_DECISION'),
    agentId,
    decision,
    reasoning,
  } satisfies AgentDecisionLog);
};

export const logAgentError = (
  agentId: string,
  error: Error,
  context: Record<string, unknown>,
): void => {
  logger.error({
    ...createBaseLog('AGENT_ERROR'),
    agentId,
    error: error.message,
    stack: error.stack,
    ...context,
  } satisfies AgentErrorLog);
};

export const logAgentWarning = (agentId: string, warning: string): void => {
  logger.info({
    ...createBaseLog('AGENT_WARNING'),
    agentId,
    warning,
  } satisfies AgentWarningLog);
};

export const logAgentPerformance = (
  agentId: string,
  operation: string,
  duration: number,
  success: boolean,
): void => {
  logger.info({
    ...createBaseLog('AGENT_PERFORMANCE'),
    agentId,
    operation,
    duration,
    success,
  } satisfies AgentPerformanceLog);
};

export const logger = pino(LOGGER_OPTIONS);
