import dotenv from 'dotenv';

dotenv.config();

const getMandatoryEnv = (varname: string): string => {
  const value = process.env[varname];
  if (!value)
    throw new Error(
      `Environment variable ${varname} must be defined and not falsy.`,
    );
  return value;
};

export const PORT = parseInt(process.env.PORT || '3000');

export const OPENAI_API_KEY = getMandatoryEnv('OPENAI_API_KEY');///
export const ANTHROPIC_API_KEY = getMandatoryEnv('ANTHROPIC_API_KEY');///
export const XAI_API_KEY = getMandatoryEnv('XAI_API_KEY');///

export const UNKEY_API_ID = getMandatoryEnv('UNKEY_API_ID');
