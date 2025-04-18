import dotenv from 'dotenv';
import ftsMetadata from '@/app/data/fts.json';
import { isNearNetworkId, NearNetworkId } from '@/lib/types';

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

export const NEAR_RPC_URL = getMandatoryEnv('NEAR_RPC_URL');//?
export const NEAR_NETWORK_ID = ((): NearNetworkId => {
  const id = getMandatoryEnv('NEAR_NETWORK_ID');//?
  if (!isNearNetworkId(id))
    throw new Error('NEAR_NETWORK_ID needs to be `testnet` or `mainnet`');
  return id;
})();

export const PIMLICO_KEY = getMandatoryEnv('PIMLICO_KEY');

export const UNKEY_API_ID = getMandatoryEnv('UNKEY_API_ID');

export const IS_TESTNET = NEAR_NETWORK_ID === 'testnet';
export const BITTE_WALLET = 'wallet.bitte.ai';
export const BITTE_WALLET_URL = IS_TESTNET
  ? `https://testnet.${BITTE_WALLET}`
  : `https://${BITTE_WALLET}`;
export const FTS_METADATA = ftsMetadata;
