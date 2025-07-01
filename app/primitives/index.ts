export enum BittePrimitiveName {
  TRANSFER_FT = 'transfer-ft',
  GENERATE_TRANSACTION = 'generate-transaction',
  SUBMIT_QUERY = 'submit-query',
  GENERATE_IMAGE = 'generate-image',
  GET_SWAP_TRANSACTIONS = 'getSwapTransactions',
  GET_TOKEN_METADATA = 'getTokenMetadata',
  GENERATE_EVM_TX = 'generate-evm-tx',
  GENERATE_SUI_TX = 'generate-sui-tx',
  RENDER_CHART = 'render-chart',
  SIGN_MESSAGE = 'sign-message',
  GET_PORTFOLIO = 'get-portfolio',
  SWAP_ON_AFTERMATH = 'aftermath-sui-swap',
  GET_SUI_BALANCES = 'get-sui-balances',
  SUI_LIQUID_STAKING = 'sui-lst',
  DATA_RETRIEVAL = 'data-retrieval',
}

export const isBittePrimitiveName = (
  value: unknown
): value is BittePrimitiveName => {
  return Object.values(BittePrimitiveName).includes(
    value as BittePrimitiveName
  );
};
